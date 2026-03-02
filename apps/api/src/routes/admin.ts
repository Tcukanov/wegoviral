import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma/client";
import { runTrendingScraper } from "../services/scraper/instagramScraper";
import { getQueueStatus } from "../services/scraper/scraperQueue";

const router = Router();

// GET /api/admin/stats
router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalAnalyzed, trendingNow, lastRun, categoryCount] = await Promise.all([
      prisma.userPostAnalysis.count({ where: { createdAt: { gte: today } } }),
      prisma.trendingReel.count(),
      prisma.scraperRun.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.trendingReel.groupBy({
        by: ["category"],
        _count: { category: true },
        orderBy: { _count: { category: "desc" } },
        take: 1,
      }),
    ]);

    res.json({
      totalAnalyzed,
      trendingNow,
      topCategory: categoryCount[0]?.category ?? "fitness",
      lastScraped: lastRun?.finishedAt ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/scrape — manually trigger scraper
router.post("/scrape", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: "Scraper started" });
    runTrendingScraper().catch((err) =>
      console.error("[Admin] Scraper error:", err)
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/queue
router.get("/queue", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getQueueStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

export default router;
