import Anthropic from "@anthropic-ai/sdk";
import { ScrapedPost } from "../scraper/postScraper";
import { CategoryBenchmark } from "../viral/benchmarks";
import { computeContentIntelligence, ContentIntelligence } from "../viral/contentIntelligence";
import { prisma } from "../../prisma/client";
import { UserPostAnalysis } from "@prisma/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ProbabilityBoost {
  icon: string;
  action: string;
  boost: number;
}

interface NicheComparison {
  hookRetentionEstimate: number;
  viralHookRetention: number;
  faceOnCamera: boolean;
  viralFacePercent: number;
  hasPatternInterrupt: boolean;
  viralPatternInterruptPercent: number;
  captionStyle: string;
  viralCaptionStyle: string;
  durationVsViral: string;
  audioStrategyVsViral: string;
  topInsight: string;
}

interface ClaudeResult {
  overallScore: number;
  hookScore: number;
  captionScore: number;
  audioScore: number;
  formatScore: number;
  engagementScore: number;
  verdict: string;
  whatWentWrong: string[];
  quickFixes: string[];
  hookFeedback: string;
  captionFeedback: string;
  audioFeedback: string;
  formatFeedback: string;
  rewrittenCaption: string;
  improvedPrompt: string;
  potentialWithFixes: number;
  viralProbability: number;
  optimizedProbability: number;
  probabilityBoosts: ProbabilityBoost[];
  nicheComparison: NicheComparison;
}

export async function analyzeUserPost(
  url: string,
  post: ScrapedPost,
  benchmark: CategoryBenchmark,
  category: string,
  platform: "instagram" | "tiktok" = "instagram"
): Promise<UserPostAnalysis & { _intel: ContentIntelligence }> {
  const likeRate    = post.views > 0 ? (post.likes    / post.views) * 100 : 0;
  const commentRate = post.views > 0 ? (post.comments / post.views) * 100 : 0;

  const likeVsBenchmark = likeRate >= benchmark.likeRate
    ? `${((likeRate / benchmark.likeRate - 1) * 100).toFixed(0)}% above`
    : `${((1 - likeRate / benchmark.likeRate) * 100).toFixed(0)}% below`;

  const commentVsBenchmark = commentRate >= benchmark.commentRate
    ? `${((commentRate / benchmark.commentRate - 1) * 100).toFixed(0)}% above`
    : `${((1 - commentRate / benchmark.commentRate) * 100).toFixed(0)}% below`;

  const platformName  = platform === "tiktok" ? "TikTok" : "Instagram Reel";
  const platformLabel = platform === "tiktok" ? "TikTok video" : "Reel";
  const viewsLabel    = platform === "tiktok" ? "plays" : "views";
  const likesLabel    = platform === "tiktok" ? "likes (hearts)" : "likes";
  const audioContext  = platform === "tiktok"
    ? "TikTok sounds (check TikTok's trending sounds tab)"
    : "Instagram Reels audio (check Instagram's trending audio)";

  // Pre-compute content intelligence for richer analysis
  const intel = computeContentIntelligence(
    { views: post.views, likes: post.likes, comments: post.comments, hashtags: post.hashtags, postedAt: post.postedAt, duration: post.duration },
    category
  );

  const prompt = `Analyze this ${platformName} and return ONLY a valid JSON object — no markdown, no explanation outside the JSON.

POST DATA:
- Platform: ${platformName}
- Creator: @${post.username}
- Category: ${category}
- Caption: "${post.caption || "(no caption)"}"
- Hashtags: ${post.hashtags.length > 0 ? post.hashtags.join(" ") : "(none)"}
- Audio: ${post.audioName || `Original audio (no trending sound from ${audioContext})`}
- Duration: ${post.duration > 0 ? `${post.duration}s (${category} ideal: ${benchmark.idealDuration}s)` : `unknown (treat as a ${platformLabel})`}
${post.views > 0
  ? `- ${viewsLabel.charAt(0).toUpperCase() + viewsLabel.slice(1)}: ${post.views.toLocaleString()}
- ${likesLabel.charAt(0).toUpperCase() + likesLabel.slice(1)}: ${post.likes.toLocaleString()} → Like rate: ${likeRate.toFixed(2)}% (${category} avg ${benchmark.likeRate}% — this post is ${likeVsBenchmark} benchmark)
- Comments: ${post.comments.toLocaleString()} → Comment rate: ${commentRate.toFixed(2)}% (${category} avg ${benchmark.commentRate}% — this post is ${commentVsBenchmark} benchmark)`
  : `- IMPORTANT: View/like/comment counts were NOT available from scraping (${platform === "tiktok" ? "TikTok" : "Instagram"} blocked the data). The post likely HAS views — do NOT assume 0 views or claim the algorithm didn't distribute it. Analyze based on caption, hashtags, audio, format, and duration ONLY. For engagement scores, give a neutral 50 and explain you couldn't access metrics. Never say "0 views" or "no engagement" in your analysis.
- Category benchmark for ${category}: like rate ${benchmark.likeRate}%, comment rate ${benchmark.commentRate}%`}

PRE-COMPUTED INTELLIGENCE (reference these numbers in your analysis):
- Posting time: ${intel.postingTime.timingVerdict} (timing score: ${intel.postingTime.timingScore}/100, est. reach loss from timing: ${intel.postingTime.estimatedReachLoss}%)
- Hashtag strategy: ${intel.hashtags.verdict} (${intel.hashtags.count} tags, score: ${intel.hashtags.score}/100${intel.hashtags.missingCategoryTags.length > 0 ? `, missing: #${intel.hashtags.missingCategoryTags.join(" #")}` : ""})
${post.views > 0
  ? `- Engagement velocity: ${intel.velocity.velocityVerdict} (${intel.velocity.viewsPerHour.toLocaleString()} views/hr, algorithm boost: ${intel.velocity.algorithmBoostEstimate}, viral benchmark: ${intel.velocity.benchmarkVph.toLocaleString()} vph)`
  : `- Engagement velocity: UNAVAILABLE (metrics not scraped — do not reference view counts or engagement rates)`}

RULES FOR YOUR RESPONSE — READ CAREFULLY:
1. ${post.views > 0 ? "Every issue and fix must reference at least one real number from the post data above." : "Metrics were not available. Focus your analysis on caption quality, hashtag strategy, audio choice, posting time, format, and content structure. Do NOT reference view counts, like rates, or comment rates. Do NOT claim the post has 0 views or no engagement."}
2. Write like a sharp friend who knows growth, NOT a marketing consultant. No corporate tone.
3. BANNED phrases (never use): "consider", "leverage", "optimize", "engage your audience", "utilize", "ensure", "it's important to", "in today's", "compelling content", "resonate with", "take your content to the next level", "boost engagement". Use plain, direct language instead.
4. The verdict must sound like a text from a mentor — one sentence, specific, no fluff. Reference the actual numbers.
5. Issues must diagnose the ROOT CAUSE, not describe the symptom. Not "weak hook" — say WHY it's weak based on what the caption/content tells you.
6. Fixes must be exact actions, not advice. Not "use trending audio" — say WHAT to do and WHY it matters for this specific post.
7. hookFeedback/audioFeedback/formatFeedback must be 2-3 sentences of real diagnosis, not generic tips.
8. rewrittenCaption must sound like the same creator wrote it — keep their slang and voice, just sharpen the hook.
9. improvedPrompt must be an opinionated, specific brief: exact opening line suggestion, exact format, exact pacing notes, why each choice matters.

BAD example of whatWentWrong (never write like this):
"The hook could be stronger to grab viewers' attention in the first 3 seconds."

GOOD example (write like this):
"Hook probably lost 60%+ of viewers before second 3 — the caption '${(post.caption || "").slice(0, 40)}...' opens with no tension, no question, no stakes. In ${category}, viral posts open with either a result ('I made $8k from one video') or a pattern interrupt ('Everyone is doing this wrong')."

BAD example of quickFixes:
"Add a trending audio track to increase your reach."

GOOD example:
"Swap to a trending sound from the ${category} top charts this week (check ${platform === "tiktok" ? "TikTok's Discover → Sounds" : "Instagram's Reels audio tab"}) — original audio cuts your algorithmic reach by ~30% compared to trending tracks in this niche."

Return this exact JSON structure:
{
  "overallScore": <number 1-100>,
  "hookScore": <number 1-100, based on how well the opening 3s likely performed>,
  "captionScore": <number 1-100>,
  "audioScore": <number 1-100, penalize heavily for non-trending audio if like rate is below benchmark>,
  "formatScore": <number 1-100, based on duration vs ideal and pacing signals>,
  "engagementScore": <number 1-100, derived from actual like/comment rates vs benchmark>,

  "verdict": "<One sentence. Must include a specific metric. Must diagnose the core failure. Max 25 words. No fluff.>",

  "whatWentWrong": [
    "<Issue 1: root cause + specific number + consequence>",
    "<Issue 2>",
    "<Issue 3>"
  ],
  "quickFixes": [
    "<Fix 1: exact action + why it matters for THIS post>",
    "<Fix 2>",
    "<Fix 3>",
    "<Fix 4>"
  ],

  "hookFeedback": "<2-3 sentences. What the first 3 seconds likely looked/felt like based on caption/hashtags. What's missing. What would have worked instead.>",
  "captionFeedback": "<2-3 sentences. Specific critique of caption structure and style. What emotion or action it fails to trigger.>",
  "audioFeedback": "<2-3 sentences. Is the audio a liability or asset? What would a better choice do for this specific post?>",
  "formatFeedback": "<2-3 sentences. Duration vs ideal for ${category}. Pacing signals. What format change would move the needle most.>",

  "rewrittenCaption": "<Rewrite their caption. Keep their exact voice and topic. Add a hook line at the start that creates tension or curiosity. Keep it under 150 chars.>",
  "improvedPrompt": "<A 100-150 word reshoot brief. Start with the exact opening line to say/show. Include: hook format, pacing, duration target, audio direction, caption structure, and one specific insight about why this will perform better.>",
  "potentialWithFixes": <number 1-100>,

  "viralProbability": <realistic % as-is, usually 1-12>,
  "optimizedProbability": <% with all fixes applied, usually 18-45>,
  "probabilityBoosts": [
    { "icon": "🎵", "action": "<specific audio action for this post>", "boost": <number> },
    { "icon": "👁", "action": "<specific hook rewrite direction>", "boost": <number> },
    { "icon": "✍️", "action": "<specific caption change>", "boost": <number> },
    { "icon": "🎥", "action": "<specific visual/format change>", "boost": <number> },
    { "icon": "⏱", "action": "<duration/pacing specific change>", "boost": <number> }
  ],

  "nicheComparison": {
    "hookRetentionEstimate": <estimated % watching past 3s — infer from like rate; low like rate = low retention>,
    "viralHookRetention": <typical viral ${category} post retention past 3s, e.g. 52>,
    "faceOnCamera": <true if content type/caption suggests a human face is shown>,
    "viralFacePercent": <% of viral ${category} posts that feature a face>,
    "hasPatternInterrupt": <true if caption/hook contains surprise, controversy, or contradiction>,
    "viralPatternInterruptPercent": <% of viral ${category} posts that use a pattern interrupt>,
    "captionStyle": "<plain|question|curiosity|controversy|how-to|list|story>",
    "viralCaptionStyle": "<dominant caption style in viral ${category} posts>",
    "durationVsViral": "<e.g. 'Your 45s is 2.5x the viral ${category} average of 18s — every extra second loses you 4% of viewers'>",
    "audioStrategyVsViral": "<e.g. 'Original audio — ${Math.round(84 - Math.random() * 15)}% of viral ${category} posts this month used trending sounds'>",
    "topInsight": "<One data-backed sentence comparing this post to viral ${category} posts. Max 20 words. Be specific.>"
  }
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: `You are a viral content strategist who has reverse-engineered thousands of Instagram Reels. You speak plainly and directly — like a smart friend in the industry, not a consultant. You always diagnose root causes, never symptoms. You never use generic advice. Your job is to tell creators exactly what killed their post and exactly how to fix it, with specifics pulled from their actual data. Return ONLY valid JSON with no text outside the JSON object.`,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content.find(c => c.type === "text")?.text?.trim() ?? "";
  let parsed: ClaudeResult;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    throw new Error(`Failed to parse Claude response: ${text.slice(0, 200)}`);
  }

  // Sanitize: clamp scores to int 1-100, fallback empty strings for required text fields
  const int = (v: unknown, fallback = 50) => Math.round(Math.min(100, Math.max(1, Number(v) || fallback)));
  const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v.trim() : fallback);
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.map(s => String(s)) : [];

  const saved = await prisma.userPostAnalysis.create({
    data: {
      instagramUrl:        url,
      instagramId:         post.instagramId,
      username:            post.username,
      category,
      thumbnailUrl:        post.thumbnailUrl || null,
      caption:             post.caption,
      hashtags:            post.hashtags,
      audioName:           post.audioName || null,
      views:               post.views,
      likes:               post.likes,
      comments:            post.comments,
      duration:            Math.max(0, post.duration),
      overallScore:        int(parsed.overallScore),
      hookScore:           int(parsed.hookScore),
      captionScore:        int(parsed.captionScore),
      audioScore:          int(parsed.audioScore),
      formatScore:         int(parsed.formatScore),
      engagementScore:     int(parsed.engagementScore),
      likeRate,
      commentRate,
      benchmarkLikeRate:   benchmark.likeRate,
      benchmarkCommentRate: benchmark.commentRate,
      verdict:             str(parsed.verdict, "Analysis complete."),
      whatWentWrong:       arr(parsed.whatWentWrong),
      quickFixes:          arr(parsed.quickFixes),
      hookFeedback:        str(parsed.hookFeedback, "No hook feedback."),
      captionFeedback:     str(parsed.captionFeedback, "No caption feedback."),
      audioFeedback:       str(parsed.audioFeedback, "No audio feedback."),
      formatFeedback:      str(parsed.formatFeedback, "No format feedback."),
      rewrittenCaption:    str(parsed.rewrittenCaption, post.caption),
      improvedPrompt:      str(parsed.improvedPrompt, "No brief generated."),
      potentialWithFixes:  int(parsed.potentialWithFixes),
      viralProbability:    Math.max(0, Number(parsed.viralProbability) || 0),
      optimizedProbability: Math.max(0, Number(parsed.optimizedProbability) || 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      probabilityBoosts:   (parsed.probabilityBoosts ?? []) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nicheComparison:     (parsed.nicheComparison ?? {}) as any,
    },
  });

  // Attach computed intelligence (not stored in DB, computed fresh each time)
  return Object.assign(saved, { _intel: intel });
}
