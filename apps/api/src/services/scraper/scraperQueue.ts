import Bull from "bull";
import { prisma } from "../../prisma/client";
import { generateTrendingAnalysis } from "../claude/trendingAnalysis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const analysisQueue = new Bull("reel-analysis", REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

analysisQueue.process(async (job) => {
  const { reelId } = job.data as { reelId: string };

  const reel = await prisma.trendingReel.findUnique({
    where: { id: reelId },
    include: { analysis: true },
  });

  if (!reel || reel.analysis) return;

  await generateTrendingAnalysis(reel);
});

analysisQueue.on("failed", (job, err) => {
  console.error(`[Queue] Job ${job.id} failed:`, err.message);
});

export async function addAnalysisJob(reelId: string): Promise<void> {
  await analysisQueue.add({ reelId }, { delay: 1000 });
}

export async function getQueueStatus() {
  const [waiting, active, completed, failed] = await Promise.all([
    analysisQueue.getWaitingCount(),
    analysisQueue.getActiveCount(),
    analysisQueue.getCompletedCount(),
    analysisQueue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}
