import cron from "node-cron";
import { runTrendingScraper, refreshVelocityScores } from "../services/scraper/instagramScraper";

export function startScraperCron(): void {
  // Discovery: every 3 hours — find new trending reels
  cron.schedule("0 */3 * * *", async () => {
    console.log("[Cron] Starting trending discovery...");
    try {
      const count = await runTrendingScraper();
      console.log(`[Cron] Discovery complete. ${count} reels upserted.`);
    } catch (err) {
      console.error("[Cron] Discovery failed:", err instanceof Error ? err.message : err);
    }
  });

  // Velocity refresh: every 6 hours — recalculate trending scores
  cron.schedule("30 */6 * * *", async () => {
    console.log("[Cron] Starting velocity refresh...");
    try {
      const count = await refreshVelocityScores();
      console.log(`[Cron] Velocity refresh complete. ${count} scores updated.`);
    } catch (err) {
      console.error("[Cron] Velocity refresh failed:", err instanceof Error ? err.message : err);
    }
  });

  console.log("[Cron] Scheduled: discovery (every 3h), velocity refresh (every 6h)");
}
