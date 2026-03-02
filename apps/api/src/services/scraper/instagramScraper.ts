/**
 * Instagram Trending Scraper v3
 *
 * Uses direct Instagram API calls (no Puppeteer) for:
 *   1. Trending reels discovery (Instagram's Reels trending endpoint)
 *   2. Niche hashtag top posts
 *   3. Curated creator profiles
 *
 * Tracks velocity via ReelSnapshot for trending score calculation.
 */

import { prisma } from "../../prisma/client";
import { InstagramClient } from "../instagram/client";
import { discoverAll } from "../instagram/discovery";
import { DiscoveredReel } from "../instagram/types";
import { calculateTrendingScore } from "../viral/viralScore";
import { detectCategory } from "../viral/benchmarks";
import { addAnalysisJob } from "./scraperQueue";

// ─── Upsert a batch of discovered reels ──────────────────────────────────────

async function upsertReels(reels: DiscoveredReel[]): Promise<number> {
  let count = 0;

  for (const reel of reels) {
    try {
      const category = detectCategory(reel.caption, reel.hashtags);

      // Get latest snapshot for velocity calculation
      const existingReel = await prisma.trendingReel.findUnique({
        where: { instagramId: reel.instagramId },
        select: { id: true, views: true, scrapedAt: true, peakVelocity: true },
      });

      const { trendingScore, velocityPerHour } = calculateTrendingScore({
        views: reel.views,
        likes: reel.likes,
        comments: reel.comments,
        isAudioTrending: reel.isAudioTrending,
        postedAt: reel.postedAt,
        category,
        previousViews: existingReel?.views ?? null,
        previousCapturedAt: existingReel?.scrapedAt ?? null,
      });

      const peakVelocity = velocityPerHour;

      const saved = await prisma.trendingReel.upsert({
        where: { instagramId: reel.instagramId },
        create: {
          instagramId: reel.instagramId,
          url: reel.url,
          username: reel.username,
          displayName: reel.displayName,
          avatarUrl: reel.avatarUrl,
          thumbnailUrl: reel.thumbnailUrl,
          caption: reel.caption,
          hashtags: reel.hashtags,
          audioName: reel.audioName,
          isAudioTrending: reel.isAudioTrending,
          views: reel.views,
          likes: reel.likes,
          comments: reel.comments,
          duration: reel.duration,
          postedAt: reel.postedAt,
          viralScore: trendingScore,
          category,
          source: reel.source,
          followerCount: reel.followerCount ?? null,
          velocityPerHour,
          peakVelocity,
        },
        update: {
          views: reel.views,
          likes: reel.likes,
          comments: reel.comments,
          viralScore: trendingScore,
          velocityPerHour,
          peakVelocity: existingReel
            ? Math.max(existingReel.peakVelocity, velocityPerHour)
            : peakVelocity,
          ...(reel.followerCount != null && { followerCount: reel.followerCount }),
          scrapedAt: new Date(),
        },
      });

      // Record snapshot for velocity tracking
      await prisma.reelSnapshot.create({
        data: {
          reelId: saved.id,
          views: reel.views,
          likes: reel.likes,
          comments: reel.comments,
        },
      });

      // Queue AI analysis for new reels
      if (!existingReel) {
        try {
          await addAnalysisJob(saved.id);
        } catch {
          /* Redis may not be running */
        }
      }

      count++;
    } catch (err) {
      console.error(
        `  [upsert] ${reel.instagramId} (@${reel.username}):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return count;
}

// ─── Velocity refresh: re-score existing reels with latest snapshots ─────────

export async function refreshVelocityScores(): Promise<number> {
  console.log("\n⚡ Refreshing velocity scores...\n");

  const reels = await prisma.trendingReel.findMany({
    where: {
      // Only refresh reels from the last 7 days
      discoveredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: {
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 2,
      },
    },
  });

  let updated = 0;

  for (const reel of reels) {
    const [latest, previous] = reel.snapshots;
    if (!latest) continue;

    const { trendingScore, velocityPerHour } = calculateTrendingScore({
      views: reel.views,
      likes: reel.likes,
      comments: reel.comments,
      isAudioTrending: reel.isAudioTrending,
      postedAt: reel.postedAt,
      category: reel.category,
      previousViews: previous?.views ?? null,
      previousCapturedAt: previous?.capturedAt ?? null,
    });

    await prisma.trendingReel.update({
      where: { id: reel.id },
      data: {
        viralScore: trendingScore,
        velocityPerHour,
        peakVelocity: Math.max(reel.peakVelocity, velocityPerHour),
      },
    });

    updated++;
  }

  console.log(`  ⚡ Updated ${updated} reel scores\n`);
  return updated;
}

// ─── Cleanup old snapshots (keep last 20 per reel) ───────────────────────────

async function cleanupSnapshots(): Promise<void> {
  const reels = await prisma.trendingReel.findMany({
    select: { id: true },
  });

  for (const reel of reels) {
    const snapshots = await prisma.reelSnapshot.findMany({
      where: { reelId: reel.id },
      orderBy: { capturedAt: "desc" },
      skip: 20,
      select: { id: true },
    });

    if (snapshots.length > 0) {
      await prisma.reelSnapshot.deleteMany({
        where: { id: { in: snapshots.map((s) => s.id) } },
      });
    }
  }
}

// ─── Prune reels older than 14 days ──────────────────────────────────────────

async function pruneOldReels(): Promise<number> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const { count } = await prisma.trendingReel.deleteMany({
    where: {
      discoveredAt: { lt: cutoff },
      analysis: { is: null },
    },
  });

  if (count > 0) console.log(`  🗑  Pruned ${count} stale reels`);
  return count;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function runTrendingScraper(): Promise<number> {
  const run = await prisma.scraperRun.create({ data: { status: "running" } });

  try {
    const client = InstagramClient.fromEnv();

    // Verify session before starting
    const valid = await client.verifySession();
    if (!valid) {
      throw new Error(
        "SESSION_EXPIRED: Instagram session invalid. Update cookies in .env"
      );
    }

    console.log("✅ Instagram session valid\n");

    // Discover from all sources
    const discovered = await discoverAll(client);

    // Upsert to database
    console.log(`\n💾 Saving ${discovered.length} reels...\n`);
    const total = await upsertReels(discovered);

    // Maintenance
    await cleanupSnapshots();
    await pruneOldReels();

    await prisma.scraperRun.update({
      where: { id: run.id },
      data: { status: "done", finishedAt: new Date(), reelsFound: total },
    });

    console.log(`\n✅ Scraper complete. ${total} reels upserted.\n`);
    return total;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.scraperRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), error: msg },
    });
    throw err;
  }
}

