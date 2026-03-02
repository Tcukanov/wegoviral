import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  scrapePost,
  scrapeTikTokPost,
  extractShortcode,
  extractTikTokVideoId,
  detectPlatform,
} from "../services/scraper/postScraper";
import { analyzeUserPost } from "../services/claude/userPostAnalysis";
import { getBenchmarks, detectCategory } from "../services/viral/benchmarks";
import { computeContentIntelligence } from "../services/viral/contentIntelligence";
import { prisma } from "../prisma/client";
import { createError } from "../middleware/errorHandler";

const router = Router();

const AnalyzeBodySchema = z.object({
  url: z.string().url().refine(
    (u) => /instagram\.com|instagr\.am|tiktok\.com|vm\.tiktok\.com/.test(u),
    { message: "URL must be an Instagram or TikTok link" }
  ),
});

const CACHE_HOURS = 24;

// Dedup lock: prevents concurrent requests for the same post from spawning
// multiple scrape + Claude calls (which wastes API credits)
const inFlight = new Map<string, Promise<ReturnType<typeof formatResponse>>>();

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = AnalyzeBodySchema.safeParse(req.body);
    if (!parse.success) {
      return next(createError("Please paste a valid Instagram or TikTok URL.", 400));
    }

    const { url } = parse.data;
    const platform = detectPlatform(url);

    const postId = platform === "tiktok"
      ? extractTikTokVideoId(url)
      : extractShortcode(url);

    if (!postId) return next(createError("Could not extract post ID from URL.", 400));

    // Cache lookup (24h) — duration > 0 skips incomplete scrapes
    const cacheKey = platform === "tiktok" ? `tt_${postId}` : postId;
    const cached = postId !== "short-url"
      ? await prisma.userPostAnalysis.findFirst({
          where: {
            instagramId: cacheKey,
            createdAt: { gte: new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000) },
            duration: { gt: 0 },
          },
          orderBy: { createdAt: "desc" },
        })
      : null;

    if (cached) {
      return res.json(formatResponse(cached));
    }

    // If another request for the same post is already in flight, wait for it
    if (inFlight.has(cacheKey)) {
      const result = await inFlight.get(cacheKey)!;
      return res.json(result);
    }

    const work = (async () => {
      let post;
      try {
        post = platform === "tiktok"
          ? await scrapeTikTokPost(url)
          : await scrapePost(url);

        if (platform === "tiktok") {
          post.instagramId = `tt_${post.instagramId}`;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Scrape failed";
        const platformName = platform === "tiktok" ? "TikTok" : "Instagram";
        if (msg === "PRIVATE_ACCOUNT") throw createError("This account is private. We can only analyze public posts.", 422);
        if (msg === "POST_NOT_FOUND") throw createError(`Post not found. Make sure the ${platformName} URL is correct and the post is public.`, 404);
        if (msg === "RATE_LIMITED") throw createError(`${platformName} is rate limiting us. Please try again in 30 seconds.`, 429);
        if (msg === "INVALID_URL") throw createError(`Invalid ${platformName} URL format.`, 400);
        throw err;
      }

      const category = detectCategory(post.caption, post.hashtags);
      const benchmark = getBenchmarks(category);
      const analysis = await analyzeUserPost(url, post, benchmark, category, platform ?? "instagram");
      return formatResponse(analysis);
    })();

    inFlight.set(cacheKey, work);

    try {
      const result = await work;
      res.json(result);
    } catch (err) {
      // If it's one of our formatted errors, pass it through
      if (err && typeof err === "object" && "status" in err) {
        return next(err);
      }
      throw err;
    } finally {
      inFlight.delete(cacheKey);
    }
  } catch (err) {
    next(err);
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatResponse(analysis: any) {
  const category: string = analysis.category && analysis.category !== "other"
    ? analysis.category
    : detectCategory(analysis.caption, analysis.hashtags ?? []);

  // Use attached intel if present (fresh analysis), otherwise recompute from stored data
  const intel = analysis._intel ?? computeContentIntelligence(
    {
      views: analysis.views,
      likes: analysis.likes,
      comments: analysis.comments,
      hashtags: analysis.hashtags ?? [],
      postedAt: analysis.createdAt ? new Date(analysis.createdAt) : null,
      duration: analysis.duration,
    },
    category,
  );

  return {
    id: analysis.id,
    category,
    post: {
      instagramUrl:  analysis.instagramUrl,
      username:      analysis.username,
      thumbnailUrl:  analysis.thumbnailUrl,
      caption:       analysis.caption,
      hashtags:      analysis.hashtags,
      audioName:     analysis.audioName,
      views:         analysis.views,
      likes:         analysis.likes,
      comments:      analysis.comments,
      duration:      analysis.duration > 0 ? analysis.duration : null,
    },
    scores: {
      overall:            analysis.overallScore,
      hook:               analysis.hookScore,
      caption:            analysis.captionScore,
      audio:              analysis.audioScore,
      format:             analysis.formatScore,
      engagement:         analysis.engagementScore,
      potentialWithFixes: analysis.potentialWithFixes,
    },
    benchmark: {
      likeRate:    analysis.benchmarkLikeRate,
      commentRate: analysis.benchmarkCommentRate,
    },
    actual: {
      likeRate:    analysis.likeRate,
      commentRate: analysis.commentRate,
    },
    verdict:             analysis.verdict,
    whatWentWrong:       analysis.whatWentWrong,
    quickFixes:          analysis.quickFixes,
    hookFeedback:        analysis.hookFeedback,
    captionFeedback:     analysis.captionFeedback,
    audioFeedback:       analysis.audioFeedback,
    formatFeedback:      analysis.formatFeedback,
    rewrittenCaption:    analysis.rewrittenCaption,
    improvedPrompt:      analysis.improvedPrompt,
    viralProbability:    analysis.viralProbability ?? 0,
    optimizedProbability: analysis.optimizedProbability ?? 0,
    probabilityBoosts:   analysis.probabilityBoosts ?? [],
    nicheComparison:     analysis.nicheComparison ?? {},
    contentIntelligence: intel,
    createdAt:           analysis.createdAt,
  };
}

export default router;
