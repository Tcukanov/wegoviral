/**
 * Content Intelligence — extracts actionable signals from already-scraped data.
 *
 * Three modules:
 *   1. Posting time analysis  — when they posted vs category peak windows
 *   2. Hashtag audit          — count, breadth, relevance, specific recommendations
 *   3. Engagement velocity    — views/hour, algorithm boost estimation
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PostingTimeIntelligence {
  postedHourUTC: number;
  postedDayOfWeek: string;
  isOptimalWindow: boolean;
  optimalWindows: string[];
  timingScore: number;        // 0-100
  timingVerdict: string;
  estimatedReachLoss: number; // % of potential reach lost due to bad timing
}

export interface HashtagIntelligence {
  count: number;
  score: number;              // 0-100
  verdict: string;
  broadTags: string[];        // >50M posts, hard to rank
  nicheTags: string[];        // specific, good for discovery
  missingCategoryTags: string[];
  recommendations: string[];
}

export interface VelocityIntelligence {
  viewsPerHour: number;
  estimatedFirst24hViews: number;
  algorithmBoostEstimate: "strong" | "moderate" | "weak" | "none";
  velocityScore: number;      // 0-100
  velocityVerdict: string;
  benchmarkVph: number;
}

export interface ContentIntelligence {
  postingTime: PostingTimeIntelligence;
  hashtags: HashtagIntelligence;
  velocity: VelocityIntelligence;
}

// ─── Posting Time ───────────────────────────────────────────────────────────

// Peak engagement windows per category (hours in UTC, roughly adjusted for US audience)
// Source: aggregated from multiple social media studies
const CATEGORY_PEAK_HOURS: Record<string, { days: number[]; hours: number[][] }> = {
  food:       { days: [0, 2, 4, 5, 6],    hours: [[11, 14], [17, 20]] },
  fitness:    { days: [1, 2, 3, 4, 5],    hours: [[6, 9], [17, 19]] },
  beauty:     { days: [0, 3, 5, 6],       hours: [[10, 13], [19, 22]] },
  comedy:     { days: [0, 4, 5, 6],       hours: [[12, 15], [19, 23]] },
  finance:    { days: [1, 2, 3, 4],       hours: [[7, 10], [12, 14]] },
  motivation: { days: [0, 1],             hours: [[5, 8], [20, 23]] },
  lifestyle:  { days: [0, 5, 6],          hours: [[9, 12], [18, 21]] },
  travel:     { days: [0, 4, 5, 6],       hours: [[10, 13], [18, 21]] },
  fashion:    { days: [0, 3, 5, 6],       hours: [[10, 13], [18, 21]] },
  tech:       { days: [1, 2, 3, 4],       hours: [[9, 12], [14, 17]] },
  pets:       { days: [0, 5, 6],          hours: [[8, 11], [18, 21]] },
  sports:     { days: [0, 1, 4, 5, 6],   hours: [[12, 15], [18, 22]] },
  music:      { days: [0, 4, 5, 6],       hours: [[14, 17], [20, 23]] },
  gaming:     { days: [0, 4, 5, 6],       hours: [[14, 17], [20, 24]] },
  education:  { days: [1, 2, 3, 4],       hours: [[8, 11], [14, 17]] },
  other:      { days: [0, 2, 4, 5, 6],    hours: [[10, 14], [18, 21]] },
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatHourRange(range: number[]): string {
  const fmt = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hr}${ampm}`;
  };
  return `${fmt(range[0])}–${fmt(range[1])}`;
}

export function analyzePostingTime(
  postedAt: Date | null,
  category: string
): PostingTimeIntelligence {
  if (!postedAt) {
    return {
      postedHourUTC: -1,
      postedDayOfWeek: "unknown",
      isOptimalWindow: false,
      optimalWindows: [],
      timingScore: 50,
      timingVerdict: "Posting time unknown — couldn't assess timing impact.",
      estimatedReachLoss: 0,
    };
  }

  const date = new Date(postedAt);
  const hourUTC = date.getUTCHours();
  const dayIdx = date.getUTCDay();
  const dayName = DAY_NAMES[dayIdx];
  const peaks = CATEGORY_PEAK_HOURS[category] ?? CATEGORY_PEAK_HOURS.other;

  const isGoodDay = peaks.days.includes(dayIdx);
  const isGoodHour = peaks.hours.some(([start, end]) => hourUTC >= start && hourUTC < end);
  const isOptimal = isGoodDay && isGoodHour;

  const optimalWindows = peaks.hours.map(formatHourRange);
  const optimalDays = peaks.days.map(d => DAY_NAMES[d]).slice(0, 3);

  let timingScore: number;
  let estimatedReachLoss: number;
  let timingVerdict: string;

  if (isOptimal) {
    timingScore = 90;
    estimatedReachLoss = 0;
    timingVerdict = `Posted ${dayName} at ${hourUTC}:00 UTC — right in the peak window for ${category}. Timing wasn't the problem here.`;
  } else if (isGoodDay || isGoodHour) {
    timingScore = 55;
    estimatedReachLoss = 20;
    timingVerdict = isGoodDay
      ? `${dayName} is good for ${category}, but ${hourUTC}:00 UTC misses the peak hours (${optimalWindows.join(" & ")}). ~20% reach left on the table.`
      : `${hourUTC}:00 UTC is a decent hour, but ${dayName} isn't peak for ${category}. Best days: ${optimalDays.join(", ")}.`;
  } else {
    timingScore = 20;
    estimatedReachLoss = 40;
    timingVerdict = `Posted ${dayName} at ${hourUTC}:00 UTC — both day and hour miss the ${category} peak windows (${optimalDays.join(", ")}, ${optimalWindows.join(" & ")} UTC). This alone could cost ~40% of potential reach.`;
  }

  return {
    postedHourUTC: hourUTC,
    postedDayOfWeek: dayName,
    isOptimalWindow: isOptimal,
    optimalWindows,
    timingScore,
    timingVerdict,
    estimatedReachLoss,
  };
}

// ─── Hashtag Audit ──────────────────────────────────────────────────────────

// Approximate post volume tiers (rough heuristics based on known tag sizes)
const MEGA_TAGS = new Set([
  "love", "instagood", "fashion", "photooftheday", "photography",
  "beautiful", "instagram", "picoftheday", "nature", "happy",
  "follow", "travel", "style", "repost", "like4like", "food",
  "fitness", "art", "selfie", "smile", "music", "likeforlikes",
  "followme", "beauty", "life", "funny", "viral", "trending",
  "explorepage", "explore", "reels", "reelsviral", "fyp",
  "foryou", "foryoupage", "tiktok",
]);

// Category-specific tags that signal niche relevance
const CATEGORY_POWER_TAGS: Record<string, string[]> = {
  food:       ["recipe", "homemade", "foodie", "easyrecipe", "mealprep", "cookwithme", "foodtok"],
  fitness:    ["workout", "gymtok", "hiit", "gains", "fitcheck", "personaltrainer"],
  beauty:     ["grwm", "makeuptutorial", "skincareroutine", "beautytok", "glowup"],
  comedy:     ["skit", "relatable", "comedyreels", "funnyvideos"],
  finance:    ["moneytok", "sidehustle", "investing101", "personalfinance"],
  motivation: ["mindset", "discipline", "selfimprovement", "growthmindset"],
  lifestyle:  ["dayinmylife", "routines", "aesthetic", "vlog"],
  travel:     ["traveltok", "wanderlust", "travelgram", "hiddenspots"],
  fashion:    ["outfitinspo", "ootd", "styleinspo", "fashiontok"],
  tech:       ["techtok", "techreview", "coding", "gadgets"],
  pets:       ["dogsofinstagram", "catsofinstagram", "pettok"],
  sports:     ["highlights", "gameday", "sportstok"],
  music:      ["newmusic", "singersongwriter", "musictok"],
  gaming:     ["gamingsetup", "gameclips", "gamingtok"],
  education:  ["learnontiktok", "didyouknow", "edutok"],
};

export function analyzeHashtags(
  hashtags: string[],
  category: string
): HashtagIntelligence {
  const tags = hashtags.map(h => h.toLowerCase().replace(/^#/, ""));
  const count = tags.length;
  const powerTags = CATEGORY_POWER_TAGS[category] ?? [];

  const broadTags = tags.filter(t => MEGA_TAGS.has(t));
  const nicheTags = tags.filter(t => !MEGA_TAGS.has(t) && t.length > 5);
  const presentPowerTags = tags.filter(t => powerTags.includes(t));
  const missingCategoryTags = powerTags
    .filter(t => !tags.includes(t))
    .slice(0, 4);

  const recommendations: string[] = [];
  let score = 50;

  // Count scoring
  const categoryLabel = category === "other" ? "niche-relevant" : category;

  if (count === 0) {
    score = 5;
    recommendations.push(
      `No hashtags at all — you're invisible to discovery. Add 5-8 targeted ${categoryLabel} tags.`
    );
  } else if (count < 3) {
    score = 25;
    recommendations.push(`Only ${count} hashtag${count > 1 ? "s" : ""} — too few for discovery. Aim for 5-10.`);
  } else if (count >= 5 && count <= 12) {
    score = 70;
  } else if (count > 20) {
    score -= 10;
    recommendations.push("Over 20 hashtags — Instagram may deprioritize. Trim to your top 8-12.");
  }

  // Breadth scoring
  const broadRatio = count > 0 ? broadTags.length / count : 0;
  if (broadRatio > 0.6 && count > 2) {
    score -= 15;
    recommendations.push(
      `${broadTags.length}/${count} tags are mega-broad (${broadTags.slice(0, 3).map(t => "#" + t).join(", ")}). You're competing with 500M+ posts. Replace with niche tags.`
    );
  }

  // Category relevance
  if (presentPowerTags.length === 0 && count > 0) {
    score -= 10;
    recommendations.push(
      `No ${category}-specific discovery tags. Add: ${missingCategoryTags.map(t => "#" + t).join(", ")}`
    );
  } else if (presentPowerTags.length >= 2) {
    score += 15;
  }

  // Niche tag bonus
  if (nicheTags.length >= 3) {
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));

  let verdict: string;
  if (count === 0) {
    verdict = "No hashtags = no discovery. This is the single easiest fix.";
  } else if (score >= 70) {
    verdict = `Solid hashtag mix — ${nicheTags.length} niche tags + ${presentPowerTags.length} category-relevant tags.`;
  } else if (score >= 40) {
    verdict = `Decent but unoptimized — too many broad tags dilute your reach.`;
  } else {
    verdict = `Weak hashtag strategy — ${count > 0 ? "mostly generic tags that won't help discovery" : "no tags at all"}.`;
  }

  return {
    count,
    score,
    verdict,
    broadTags,
    nicheTags,
    missingCategoryTags,
    recommendations,
  };
}

// ─── Engagement Velocity ────────────────────────────────────────────────────

// Benchmark views/hour for "viral" content per category (first 24h average)
const VIRAL_VPH: Record<string, number> = {
  food: 8000,     fitness: 6000,   beauty: 7000,
  comedy: 15000,  finance: 4000,   motivation: 5000,
  lifestyle: 5000, travel: 6000,   fashion: 7000,
  tech: 4000,     pets: 10000,     sports: 8000,
  music: 12000,   gaming: 6000,    education: 3000,
  other: 5000,
};

export function analyzeVelocity(
  views: number,
  postedAt: Date | null,
  category: string
): VelocityIntelligence {
  const benchmarkVph = VIRAL_VPH[category] ?? VIRAL_VPH.other;

  if (!postedAt || views === 0) {
    return {
      viewsPerHour: 0,
      estimatedFirst24hViews: 0,
      algorithmBoostEstimate: "none",
      velocityScore: 0,
      velocityVerdict: views === 0
        ? "0 views — the algorithm likely never distributed this beyond followers."
        : "Couldn't calculate velocity without a post date.",
      benchmarkVph,
    };
  }

  const hoursOld = Math.max(0.1, (Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60));
  const vph = views / hoursOld;

  // Estimate what first 24h looked like (Instagram/TikTok front-loads distribution)
  // Most engagement happens in first 6-12 hours; after that it flattens
  const estimatedFirst24hViews = hoursOld <= 24
    ? views
    : Math.round(views * Math.min(1, 24 / hoursOld) * 1.8); // ~1.8x because of front-loading

  let algorithmBoostEstimate: VelocityIntelligence["algorithmBoostEstimate"];
  let velocityScore: number;

  const vphRatio = vph / benchmarkVph;

  if (vphRatio >= 1.0) {
    algorithmBoostEstimate = "strong";
    velocityScore = Math.min(100, Math.round(80 + vphRatio * 10));
  } else if (vphRatio >= 0.4) {
    algorithmBoostEstimate = "moderate";
    velocityScore = Math.round(40 + vphRatio * 40);
  } else if (vphRatio >= 0.1) {
    algorithmBoostEstimate = "weak";
    velocityScore = Math.round(vphRatio * 100);
  } else {
    algorithmBoostEstimate = "none";
    velocityScore = Math.max(1, Math.round(vphRatio * 50));
  }

  velocityScore = Math.max(0, Math.min(100, velocityScore));

  let velocityVerdict: string;

  if (algorithmBoostEstimate === "strong") {
    velocityVerdict = `${Math.round(vph).toLocaleString()} views/hour — the algorithm is actively pushing this. That's ${(vphRatio).toFixed(1)}x the viral benchmark for ${category}.`;
  } else if (algorithmBoostEstimate === "moderate") {
    velocityVerdict = `${Math.round(vph).toLocaleString()} views/hour — some algorithmic distribution but not breakout territory. Viral ${category} posts average ${benchmarkVph.toLocaleString()} vph.`;
  } else if (algorithmBoostEstimate === "weak") {
    velocityVerdict = `${Math.round(vph).toLocaleString()} views/hour — mostly follower-driven reach. The algorithm isn't pushing this. Viral ${category} content hits ${benchmarkVph.toLocaleString()} vph.`;
  } else {
    velocityVerdict = `Effectively zero algorithmic distribution. This post was likely buried after the first hour — common when the hook doesn't retain viewers past 3 seconds.`;
  }

  return {
    viewsPerHour: Math.round(vph),
    estimatedFirst24hViews,
    algorithmBoostEstimate,
    velocityScore,
    velocityVerdict,
    benchmarkVph,
  };
}

// ─── Combined ───────────────────────────────────────────────────────────────

export function computeContentIntelligence(
  post: {
    views: number;
    likes: number;
    comments: number;
    hashtags: string[];
    postedAt: Date | null;
    duration: number;
  },
  category: string
): ContentIntelligence {
  return {
    postingTime: analyzePostingTime(post.postedAt, category),
    hashtags: analyzeHashtags(post.hashtags, category),
    velocity: analyzeVelocity(post.views, post.postedAt, category),
  };
}
