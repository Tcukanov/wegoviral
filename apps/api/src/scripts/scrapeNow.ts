/**
 * Standalone scraper runner.
 * Usage: npm run scrape
 *
 * Discovers trending Reels via Instagram's internal API and saves to DB.
 * Runs outside of the web server — safe to run at any time.
 *
 * Requires IG_SESSION_ID, IG_CSRF_TOKEN, IG_DS_USER_ID in .env
 */
import "dotenv/config";
import { runTrendingScraper } from "../services/scraper/instagramScraper";
import { prisma } from "../prisma/client";

async function main() {
  console.log("\n🔍 wegoviral.ai — Trending Scraper v3\n");
  console.log("Sources: trending reels, niche hashtags, curated creators");
  console.log("Using direct Instagram API (no Puppeteer)\n");

  const start = Date.now();

  try {
    const count = await runTrendingScraper();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\n✅ Done in ${elapsed}s`);
    console.log(`   ${count} reels upserted to database\n`);

    if (count === 0) {
      console.log("⚠️  0 reels found. Possible causes:");
      console.log("   - Session cookies expired → re-extract from browser");
      console.log("   - Instagram rate limiting → wait a few minutes\n");
    } else {
      console.log("🌐 Visit http://localhost:3000/trending to see real content.\n");
    }
  } catch (err) {
    console.error("\n✗ Scraper failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
