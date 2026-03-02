/**
 * Scrape individual Instagram Reels by URL and add to trending feed.
 *
 * Usage:
 *   npm run add-reels
 *
 * Edit the REEL_URLS array below with real viral Reel URLs you find,
 * then run the script. Each URL is scraped via Instagram API and saved.
 *
 * Requires IG_SESSION_ID, IG_CSRF_TOKEN, IG_DS_USER_ID in .env
 */
import "dotenv/config";
import { InstagramClient } from "../services/instagram/client";
import { calculateTrendingScore } from "../services/viral/viralScore";
import { detectCategory } from "../services/viral/benchmarks";
import { addAnalysisJob } from "../services/scraper/scraperQueue";
import { prisma } from "../prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// PASTE YOUR REAL INSTAGRAM REEL URLS HERE
// ─────────────────────────────────────────────────────────────────────────────
const REEL_URLS: string[] = [
  "https://www.instagram.com/p/DUhaHs3EToK/",
  "https://www.instagram.com/p/C-Yld9xg10l/",
  "https://www.instagram.com/p/DBe3QaNyQEi/",
  "https://www.instagram.com/p/DPMizYbimcU/",
  "https://www.instagram.com/p/DJTxgTBTTgF/",
  "https://www.instagram.com/p/DKoVLgxuCMB/",
  "https://www.instagram.com/p/DS8hNgKkky8/",
  "https://www.instagram.com/p/DRg816tjNN-/",
  "https://www.instagram.com/p/DQUDt77COm6/",
];
// ─────────────────────────────────────────────────────────────────────────────

function extractShortcode(url: string): string | null {
  const patterns = [
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/tv\/([A-Za-z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractHashtags(text: string): string[] {
  return (text.match(/#[\w]+/g) || []).map((h) => h.slice(1).toLowerCase());
}

async function main() {
  console.log("\n📥 wegoviral.ai — Add Reels (API mode)\n");

  const urls = REEL_URLS.filter((u) => u.trim() && !u.startsWith("//"));

  if (urls.length === 0) {
    console.log("⚠️  No URLs found.");
    console.log("   Edit REEL_URLS in addReels.ts and paste your Reel URLs.\n");
    process.exit(0);
  }

  const client = InstagramClient.fromEnv();
  const valid = await client.verifySession();
  if (!valid) {
    console.error("✗ Instagram session expired. Update cookies in .env\n");
    process.exit(1);
  }

  console.log(`Found ${urls.length} URL(s) to process.\n`);
  let added = 0;
  let failed = 0;

  for (const url of urls) {
    const shortcode = extractShortcode(url);
    if (!shortcode) {
      console.log(`  ✗ Invalid URL: ${url}`);
      failed++;
      continue;
    }

    process.stdout.write(`  Fetching ${shortcode}...`);
    try {
      // Convert shortcode to media ID isn't straightforward via API,
      // so we use the web info endpoint with the shortcode
      const res = await client.getMediaInfo(shortcode);
      const item = res.items?.[0];
      if (!item) throw new Error("Post not found");

      const caption = item.caption?.text ?? "";
      const hashtags = extractHashtags(caption);
      const category = detectCategory(caption, hashtags);
      const views = item.play_count ?? item.video_view_count ?? 0;
      const likes = item.like_count ?? 0;
      const comments = item.comment_count ?? 0;
      const postedAt = item.taken_at ? new Date(item.taken_at * 1000) : null;

      const isAudioTrending =
        item.clips_metadata?.original_sound_info?.is_trending_in_clips ??
        item.clips_metadata?.music_info?.music_asset_info?.is_trending_in_clips ??
        false;

      const { trendingScore, velocityPerHour } = calculateTrendingScore({
        views,
        likes,
        comments,
        isAudioTrending,
        postedAt,
        category,
      });

      const instagramId = String(item.pk ?? item.id);

      const reel = await prisma.trendingReel.upsert({
        where: { instagramId },
        create: {
          instagramId,
          url,
          username: item.user?.username ?? "unknown",
          displayName: item.user?.full_name ?? null,
          avatarUrl: item.user?.profile_pic_url ?? null,
          thumbnailUrl: item.image_versions2?.candidates?.[0]?.url ?? "",
          caption,
          hashtags,
          audioName:
            item.clips_metadata?.original_sound_info?.original_audio_title ??
            item.music_metadata?.music_info?.music_asset_info?.title ??
            null,
          isAudioTrending,
          views,
          likes,
          comments,
          duration: Math.round(item.video_duration ?? 0),
          postedAt,
          viralScore: trendingScore,
          category,
          source: "creator",
          velocityPerHour,
          peakVelocity: velocityPerHour,
        },
        update: {
          views,
          likes,
          comments,
          viralScore: trendingScore,
          velocityPerHour,
          scrapedAt: new Date(),
        },
      });

      // Queue AI analysis
      const hasAnalysis = await prisma.trendingAnalysis.findUnique({
        where: { reelId: reel.id },
        select: { id: true },
      });
      if (!hasAnalysis) {
        try {
          await addAnalysisJob(reel.id);
        } catch {
          /* Redis may not be running */
        }
      }

      console.log(` ✓`);
      console.log(
        `     @${item.user?.username} · ${views.toLocaleString()} views · score ${trendingScore} · ${category}`
      );
      added++;

      // Polite delay
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(` ✗ ${msg}`);
      failed++;
    }
  }

  console.log(`\n✅ Done. ${added} added, ${failed} failed.\n`);
  if (added > 0) {
    console.log("🌐 Visit http://localhost:3000/trending to see them.\n");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
