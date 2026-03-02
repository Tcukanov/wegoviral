import { getBenchmarks } from "./benchmarks";

// ─── Input types ─────────────────────────────────────────────────────────────

interface ViralScoreInput {
  views: number;
  likes: number;
  comments: number;
  isAudioTrending?: boolean;
  postedAt?: Date | null;
}

interface TrendingScoreInput extends ViralScoreInput {
  category?: string;
  previousViews?: number | null;
  previousCapturedAt?: Date | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// ─── Original viral score (kept for backward compatibility with UserPostAnalysis)

export function calculateViralScore(post: ViralScoreInput): number {
  const views = Math.max(post.views, 1);
  const likeRate = (post.likes / views) * 100;
  const commentRate = (post.comments / views) * 100;

  const baseScore = likeRate * 2.5 + commentRate * 4;

  const viewBonus =
    views > 5_000_000
      ? 30
      : views > 1_000_000
        ? 22
        : views > 500_000
          ? 16
          : views > 100_000
            ? 10
            : views > 50_000
              ? 5
              : 0;

  const audioBonus = post.isAudioTrending ? 12 : 0;

  let recencyBonus = 0;
  if (post.postedAt) {
    const hoursOld =
      (Date.now() - new Date(post.postedAt).getTime()) / (1000 * 60 * 60);
    recencyBonus =
      hoursOld < 24 ? 15 : hoursOld < 72 ? 10 : hoursOld < 168 ? 5 : 0;
  }

  return clamp(
    Math.round(baseScore + viewBonus + audioBonus + recencyBonus),
    1,
    100
  );
}

// ─── Trending Score v2 (velocity-based) ──────────────────────────────────────
//
// Components:
//   Velocity    (35%) — Views/hour growth rate
//   Engagement  (25%) — Like + comment rate vs category benchmark
//   Volume      (15%) — Absolute reach, log-scaled
//   Audio       (10%) — Trending audio signal
//   Recency     (15%) — Exponential freshness decay
//

export function calculateTrendingScore(post: TrendingScoreInput): {
  trendingScore: number;
  velocityPerHour: number;
} {
  const views = Math.max(post.views, 1);
  const category = post.category ?? "other";
  const bench = getBenchmarks(category);

  // ── Velocity (35%) ─────────────────────────────────────────────────────────
  let velocityPerHour = 0;

  if (
    post.previousViews != null &&
    post.previousCapturedAt != null
  ) {
    const hoursDelta =
      (Date.now() - new Date(post.previousCapturedAt).getTime()) /
      (1000 * 60 * 60);
    if (hoursDelta > 0.1) {
      velocityPerHour = (post.views - post.previousViews) / hoursDelta;
    }
  } else if (post.postedAt) {
    // Estimate from post age when we don't have a previous snapshot
    const hoursOld =
      (Date.now() - new Date(post.postedAt).getTime()) / (1000 * 60 * 60);
    if (hoursOld > 0.1) {
      velocityPerHour = views / hoursOld;
    }
  }

  // Normalize: 50k views/hour = 100
  const velocityScore = clamp((velocityPerHour / 50_000) * 100, 0, 100);

  // ── Engagement (25%) ───────────────────────────────────────────────────────
  const likeRate = (post.likes / views) * 100;
  const commentRate = (post.comments / views) * 100;

  const likeRatio = bench.likeRate > 0 ? likeRate / bench.likeRate : 1;
  const commentRatio =
    bench.commentRate > 0 ? commentRate / bench.commentRate : 1;

  // Average of the two ratios, each capped at 2x benchmark = 100
  const engagementScore = clamp(
    ((Math.min(likeRatio, 2) + Math.min(commentRatio, 2)) / 2) * 50,
    0,
    100
  );

  // ── Volume (15%) ───────────────────────────────────────────────────────────
  // Log scale: 10M views = 100
  const volumeScore = clamp(
    (Math.log10(views) / Math.log10(10_000_000)) * 100,
    0,
    100
  );

  // ── Audio (10%) ────────────────────────────────────────────────────────────
  const audioScore = post.isAudioTrending ? 100 : 0;

  // ── Recency (15%) ──────────────────────────────────────────────────────────
  let recencyScore = 50; // default if no date
  if (post.postedAt) {
    const hoursOld =
      (Date.now() - new Date(post.postedAt).getTime()) / (1000 * 60 * 60);
    // Exponential decay: half-life of 48 hours
    recencyScore = clamp(100 * Math.pow(0.5, hoursOld / 48), 0, 100);
  }

  // ── Combine ────────────────────────────────────────────────────────────────
  const trendingScore = clamp(
    Math.round(
      velocityScore * 0.35 +
        engagementScore * 0.25 +
        volumeScore * 0.15 +
        audioScore * 0.1 +
        recencyScore * 0.15
    ),
    1,
    100
  );

  return { trendingScore, velocityPerHour };
}
