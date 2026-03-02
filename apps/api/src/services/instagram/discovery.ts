/**
 * Multi-source trending discovery
 *
 * Pulls reels from 3 sources:
 *   1. Instagram's trending reels endpoint (the actual Reels tab)
 *   2. Top posts from niche-specific hashtags
 *   3. Latest reels from curated creator profiles
 *
 * Each source returns DiscoveredReel[], which the main scraper
 * deduplicates, scores, and upserts to the database.
 */

import { InstagramClient } from "./client";
import { IGMediaNode, DiscoveredReel, DiscoverySource } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Niche hashtags to monitor ─────────────────────────────────────────────────

const NICHE_HASHTAGS: Record<string, string[]> = {
  fitness: ["fitness", "gymtok", "workout", "fitnessmotivation"],
  finance: ["personalfinance", "moneytok", "investing", "sidehustle"],
  food: ["foodtok", "recipe", "cooking", "easyrecipe"],
  beauty: ["beautytok", "grwm", "makeuptutorial", "skincare"],
  motivation: ["motivation", "mindset", "selfimprovement", "productivity"],
  comedy: ["funny", "comedy", "relatable", "memes"],
};

// ─── Curated creators (username → numeric ID, resolved lazily) ──────────────

const CREATORS: { username: string; category: string }[] = [
  { username: "cbum", category: "fitness" },
  { username: "davidlaid", category: "fitness" },
  { username: "gordonramsay", category: "food" },
  { username: "joshuaweissman", category: "food" },
  { username: "garyvee", category: "motivation" },
  { username: "khaby00", category: "comedy" },
  { username: "zachking", category: "comedy" },
  { username: "nikkietutorials", category: "beauty" },
  { username: "grahamstephan", category: "finance" },
];

// Cache: username → { userId, followerCount }
const creatorProfileCache = new Map<string, { userId: string; followerCount: number | null }>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractHashtags(text: string): string[] {
  return (text.match(/#[\w]+/g) || []).map((h) => h.slice(1).toLowerCase());
}

function mediaToReel(
  node: IGMediaNode,
  source: DiscoverySource,
  followerCount: number | null = null
): DiscoveredReel | null {
  const isVideo = node.media_type === 2 || node.video_duration != null;
  if (!isVideo) return null;

  const views =
    node.play_count ?? node.video_view_count ?? node.view_count ?? 0;
  if (views < 10_000) return null;

  const caption = node.caption?.text ?? "";
  const user = node.user ?? node.owner;
  const shortcode = node.code ?? "";
  const id = String(node.pk ?? node.id ?? "");

  if (!id || !shortcode) return null;

  const audioMeta =
    node.clips_metadata?.original_sound_info ??
    node.clips_metadata?.music_info?.music_asset_info;
  const musicMeta = node.music_metadata?.music_info?.music_asset_info;

  return {
    instagramId: id,
    shortcode,
    url: `https://www.instagram.com/reel/${shortcode}/`,
    username: user?.username ?? "unknown",
    displayName: user?.full_name ?? null,
    avatarUrl: user?.profile_pic_url ?? null,
    thumbnailUrl:
      node.image_versions2?.candidates?.[0]?.url ??
      node.thumbnail_src ??
      node.display_url ??
      "",
    caption,
    hashtags: extractHashtags(caption),
    audioName:
      (audioMeta as Record<string, unknown>)?.original_audio_title as string ??
      (audioMeta as Record<string, unknown>)?.title as string ??
      musicMeta?.title ??
      null,
    isAudioTrending:
      (node.clips_metadata?.original_sound_info?.is_trending_in_clips ||
        node.clips_metadata?.music_info?.music_asset_info
          ?.is_trending_in_clips) ??
      false,
    views,
    likes: node.like_count ?? 0,
    comments: node.comment_count ?? 0,
    duration: Math.round(node.video_duration ?? 0),
    postedAt: node.taken_at ? new Date(node.taken_at * 1000) : null,
    source,
    followerCount,
  };
}

// ─── Resolve username → profile (userId + followerCount), cached ─────────────

async function resolveProfile(
  client: InstagramClient,
  username: string
): Promise<{ userId: string; followerCount: number | null } | null> {
  if (creatorProfileCache.has(username)) return creatorProfileCache.get(username)!;

  try {
    const profile = await client.getUserProfile(username);
    creatorProfileCache.set(username, profile);
    return profile;
  } catch (err) {
    console.error(
      `  [profile] Could not resolve @${username}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ─── Enrich a list of reels with follower counts ──────────────────────────────
// Batches profile lookups per unique username (max 30 to limit API calls)

async function enrichWithFollowerCounts(
  client: InstagramClient,
  reels: DiscoveredReel[]
): Promise<DiscoveredReel[]> {
  // Collect unique usernames not yet cached
  const unknown = [...new Set(
    reels
      .filter((r) => r.username !== "unknown" && !creatorProfileCache.has(r.username))
      .map((r) => r.username)
  )].slice(0, 30);

  for (const username of unknown) {
    try {
      await resolveProfile(client, username);
      await sleep(1200 + Math.random() * 800);
    } catch {
      // non-fatal
    }
  }

  // Attach cached follower counts to reels
  return reels.map((r) => ({
    ...r,
    followerCount: creatorProfileCache.get(r.username)?.followerCount ?? r.followerCount,
  }));
}

// ─── Source 1: Trending Reels ────────────────────────────────────────────────

export async function discoverTrending(
  client: InstagramClient,
  pages = 3
): Promise<DiscoveredReel[]> {
  const reels: DiscoveredReel[] = [];
  let maxId: string | undefined;

  for (let page = 0; page < pages; page++) {
    try {
      console.log(`  [trending] Fetching page ${page + 1}/${pages}...`);
      const res = await client.getTrendingReels(maxId);

      for (const item of res.items ?? []) {
        const reel = mediaToReel(item.media, "trending");
        if (reel) reels.push(reel);
      }

      if (!res.paging_info?.more_available || !res.paging_info?.max_id) break;
      maxId = res.paging_info.max_id;

      await sleep(1500 + Math.random() * 1500);
    } catch (err) {
      console.error(
        `  [trending] Page ${page + 1} failed:`,
        err instanceof Error ? err.message : err
      );
      break;
    }
  }

  console.log(`  [trending] Found ${reels.length} reels, fetching follower counts...`);
  return enrichWithFollowerCounts(client, reels);
}

// ─── Source 2: Hashtag Top Posts ──────────────────────────────────────────────

export async function discoverFromHashtags(
  client: InstagramClient,
  categories?: string[]
): Promise<DiscoveredReel[]> {
  const reels: DiscoveredReel[] = [];
  const cats = categories ?? Object.keys(NICHE_HASHTAGS);

  for (const category of cats) {
    const tags = NICHE_HASHTAGS[category] ?? [];
    // Pick 2 random tags per category to limit API calls
    const selected = tags.sort(() => Math.random() - 0.5).slice(0, 2);

    for (const tag of selected) {
      try {
        console.log(`  [hashtag] #${tag} (${category})...`);
        const res = await client.getHashtagFeed(tag, "top");

        for (const section of res.sections ?? []) {
          for (const media of section.layout_content?.medias ?? []) {
            const reel = mediaToReel(media.media, "hashtag");
            if (reel) reels.push(reel);
          }
        }

        await sleep(2000 + Math.random() * 2000);
      } catch (err) {
        console.error(
          `  [hashtag] #${tag} failed:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  console.log(`  [hashtag] Found ${reels.length} reels, fetching follower counts...`);
  return enrichWithFollowerCounts(client, reels);
}

// ─── Source 3: Creator Reels ─────────────────────────────────────────────────

export async function discoverFromCreators(
  client: InstagramClient
): Promise<DiscoveredReel[]> {
  const reels: DiscoveredReel[] = [];

  for (const { username } of CREATORS) {
    try {
      const profile = await resolveProfile(client, username);
      if (!profile) continue;

      console.log(`  [creator] @${username} (${profile.followerCount?.toLocaleString() ?? "?"} followers)...`);
      const res = await client.getUserReels(profile.userId);

      for (const item of res.items ?? []) {
        const reel = mediaToReel(item, "creator", profile.followerCount);
        if (reel) reels.push(reel);
      }

      await sleep(2000 + Math.random() * 2000);
    } catch (err) {
      console.error(
        `  [creator] @${username} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(`  [creator] Found ${reels.length} reels`);
  return reels;
}

// ─── Run all discovery sources ───────────────────────────────────────────────

export async function discoverAll(
  client: InstagramClient
): Promise<DiscoveredReel[]> {
  console.log("\n🔍 Starting multi-source discovery...\n");

  const [trending, hashtag, creator] = await Promise.all([
    discoverTrending(client).catch((err) => {
      console.error("[discovery] Trending source failed:", err.message);
      return [] as DiscoveredReel[];
    }),
    discoverFromHashtags(client).catch((err) => {
      console.error("[discovery] Hashtag source failed:", err.message);
      return [] as DiscoveredReel[];
    }),
    discoverFromCreators(client).catch((err) => {
      console.error("[discovery] Creator source failed:", err.message);
      return [] as DiscoveredReel[];
    }),
  ]);

  // Deduplicate by instagramId, prefer trending source
  const seen = new Map<string, DiscoveredReel>();
  const priority: DiscoverySource[] = ["trending", "hashtag", "creator"];

  for (const source of [trending, hashtag, creator]) {
    for (const reel of source) {
      const existing = seen.get(reel.instagramId);
      if (
        !existing ||
        priority.indexOf(reel.source) < priority.indexOf(existing.source)
      ) {
        seen.set(reel.instagramId, reel);
      }
    }
  }

  const all = Array.from(seen.values());
  console.log(
    `\n📊 Discovery complete: ${all.length} unique reels ` +
      `(${trending.length} trending, ${hashtag.length} hashtag, ${creator.length} creator)\n`
  );

  return all;
}
