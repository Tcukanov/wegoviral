import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma/client";
import { generateTrendingAnalysis } from "../services/claude/trendingAnalysis";
import { createError } from "../middleware/errorHandler";

const router = Router();
const PAGE_SIZE = 12;

// In-memory set of reel IDs currently being analyzed (prevents duplicate Claude calls)
const analysisInProgress = new Set<string>();

// GET /api/trending
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, sort = "viralScore", page = "1", limit = "12" } = req.query;

    const where: Record<string, unknown> = {};
    if (category && category !== "all") where.category = category;

    const orderBy: Record<string, string> =
      sort === "views"
        ? { views: "desc" }
        : sort === "createdAt"
        ? { scrapedAt: "desc" }
        : { viralScore: "desc" };

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);

    const [reels, total] = await Promise.all([
      prisma.trendingReel.findMany({
        where,
        orderBy,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: { analysis: false },
      }),
      prisma.trendingReel.count({ where }),
    ]);

    res.json({ reels, total, hasMore: pageNum * limitNum < total });
  } catch (err) {
    next(err);
  }
});

// GET /api/trending/top-viral?category=food
// Returns up to 3 viral reels matching the given category.
// Prefers small influencers (<100k followers). Never mixes categories.
// Returns { matched: true/false, examples: [...] } — matched=false means no content yet for this niche.
router.get("/top-viral", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.query;
    const cat = category && category !== "all" && category !== "other"
      ? (category as string)
      : null;

    const SMALL_INFLUENCER_CAP = 100_000;

    const select = {
      url: true,
      username: true,
      views: true,
      likes: true,
      viralScore: true,
      category: true,
      followerCount: true,
      caption: true,
    };

    // No category → nothing to show
    if (!cat) {
      return res.json({ matched: false, examples: [] });
    }

    // Try 1: same category + small influencer
    let reels = await prisma.trendingReel.findMany({
      where: {
        category: cat,
        followerCount: { not: null, lte: SMALL_INFLUENCER_CAP },
      },
      orderBy: { viralScore: "desc" },
      take: 3,
      select,
    });

    // Try 2: same category, any follower count (scraper hasn't fetched it yet)
    if (reels.length < 3) {
      const existing = new Set(reels.map((r) => r.url));
      const extra = await prisma.trendingReel.findMany({
        where: {
          category: cat,
          url: { notIn: [...existing] },
        },
        orderBy: { viralScore: "desc" },
        take: 3 - reels.length,
        select,
      });
      reels = [...reels, ...extra];
    }

    // No results at all for this category yet
    if (reels.length === 0) {
      return res.json({ matched: false, examples: [], category: cat });
    }

    const examples = reels.map((r) => {
      const shortcode = r.url.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/)?.[2] ?? "";
      return {
        shortcode,
        url: r.url,
        username: r.username,
        views: r.views,
        likes: r.likes,
        viralScore: r.viralScore,
        category: r.category,
        followerCount: r.followerCount,
        caption: r.caption.slice(0, 120),
      };
    });

    res.json({ matched: true, examples, category: cat });
  } catch (err) {
    next(err);
  }
});

// GET /api/trending/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reel = await prisma.trendingReel.findUnique({
      where: { id: req.params.id },
      include: { analysis: true },
    });

    if (!reel) return next(createError("Reel not found", 404));

    if (!reel.analysis) {
      generateTrendingAnalysis(reel).catch((err) =>
        console.error("[Route] Background analysis failed:", err)
      );
    }

    res.json(reel);
  } catch (err) {
    next(err);
  }
});

// GET /api/trending/:id/analysis — poll endpoint
// Also triggers generation if none exists (frontend only calls this endpoint)
router.get(
  "/:id/analysis",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const analysis = await prisma.trendingAnalysis.findUnique({
        where: { reelId: id },
      });

      if (analysis) {
        return res.json(analysis);
      }

      // No analysis yet — kick off generation if not already running
      const reel = await prisma.trendingReel.findUnique({ where: { id } });
      if (!reel) return next(createError("Reel not found", 404));

      // Fire and forget — client polls again in 2s
      // Lock prevents duplicate calls while Claude is working
      if (!analysisInProgress.has(id)) {
        analysisInProgress.add(id);
        console.log(`[Analysis] Starting for @${reel.username} (${id})`);
        generateTrendingAnalysis(reel)
          .then(() => console.log(`[Analysis] Done: @${reel.username}`))
          .catch((err) => console.error(`[Analysis] Failed for ${id}:`, err.message))
          .finally(() => analysisInProgress.delete(id));
      }

      return res.json({ pending: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/trending — seed/admin: add a reel manually
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      instagramId, url, username, displayName, thumbnailUrl,
      caption, hashtags, audioName, isAudioTrending,
      views, likes, comments, duration, category, postedAt,
    } = req.body;

    if (!instagramId || !url || !username || !caption) {
      return next(createError("Missing required fields", 400));
    }

    const { calculateViralScore } = await import("../services/viral/viralScore");
    const viralScore = calculateViralScore({
      views: Number(views),
      likes: Number(likes),
      comments: Number(comments),
      isAudioTrending: Boolean(isAudioTrending),
      postedAt: postedAt ? new Date(postedAt) : null,
    });

    const reel = await prisma.trendingReel.upsert({
      where: { instagramId },
      create: {
        instagramId,
        url,
        username,
        displayName: displayName || null,
        thumbnailUrl: thumbnailUrl || "",
        caption,
        hashtags: hashtags || [],
        audioName: audioName || null,
        isAudioTrending: Boolean(isAudioTrending),
        views: Number(views),
        likes: Number(likes),
        comments: Number(comments),
        duration: Number(duration),
        postedAt: postedAt ? new Date(postedAt) : null,
        viralScore,
        category: category || "other",
      },
      update: { views: Number(views), viralScore },
    });

    res.status(201).json(reel);
  } catch (err) {
    next(err);
  }
});

export default router;

export { PAGE_SIZE };
