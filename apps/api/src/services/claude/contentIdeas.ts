import Anthropic from "@anthropic-ai/sdk";
import type { IGMedia } from "../instagram/graphApi";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ContentIdea {
  title: string;
  concept: string;
  hookLine: string;
  shootBrief: string;
  whyItWillWork: string;
  format: string;
  estimatedBoost: string;
}

interface AccountContext {
  username: string;
  followers: number;
  bio: string;
  media: IGMedia[];
}

function computeEngagementRate(post: IGMedia): number {
  const base = post.impressions || post.reach || 1;
  return ((post.like_count + post.comments_count + (post.saved ?? 0)) / base) * 100;
}

function summarizePost(post: IGMedia) {
  const er = computeEngagementRate(post);
  return {
    type:        post.media_type,
    caption:     (post.caption || "").slice(0, 200),
    likes:       post.like_count,
    comments:    post.comments_count,
    saves:       post.saved ?? 0,
    impressions: post.impressions ?? 0,
    reach:       post.reach ?? 0,
    videoViews:  post.video_views ?? 0,
    engagementRate: parseFloat(er.toFixed(2)),
    postedAt:    post.timestamp,
    permalink:   post.permalink,
  };
}

export async function generateContentIdeas(ctx: AccountContext): Promise<ContentIdea[]> {
  const sorted = [...ctx.media].sort((a, b) => computeEngagementRate(b) - computeEngagementRate(a));
  const top5      = sorted.slice(0, 5).map(summarizePost);
  const bottom5   = sorted.slice(-5).map(summarizePost);
  const videos    = ctx.media.filter(m => m.media_type === "VIDEO");
  const avgLikes  = Math.round(ctx.media.reduce((s, m) => s + m.like_count, 0) / Math.max(ctx.media.length, 1));
  const avgSaves  = Math.round(ctx.media.reduce((s, m) => s + (m.saved ?? 0), 0) / Math.max(ctx.media.length, 1));
  const avgImpres = Math.round(ctx.media.reduce((s, m) => s + (m.impressions ?? 0), 0) / Math.max(ctx.media.length, 1));

  const prompt = `You are a top-tier social media content strategist. Analyze this creator's actual performance data and generate 5 highly specific, immediately actionable content ideas.

ACCOUNT: @${ctx.username} | ${ctx.followers.toLocaleString()} followers
BIO: ${ctx.bio || "(no bio)"}
TOTAL POSTS ANALYZED: ${ctx.media.length}
ACCOUNT AVERAGES: ${avgLikes} likes/post · ${avgSaves} saves/post · ${avgImpres.toLocaleString()} impressions/post

TOP 5 PERFORMING POSTS (sorted by engagement rate):
${JSON.stringify(top5, null, 2)}

BOTTOM 5 POSTS (what's NOT working):
${JSON.stringify(bottom5, null, 2)}

CONTENT MIX: ${videos.length} videos out of ${ctx.media.length} total posts

RULES FOR YOUR RESPONSE:
1. Every idea must be rooted in their actual data — reference specific numbers
2. BANNED phrases: "consider", "leverage", "optimize", "engage", "resonate", "comprehensive"
3. Each idea must be immediately executable — no vague suggestions
4. The hookLine is the exact first words to say/show on camera
5. Format types: "talking head 15-30s" | "voiceover B-roll" | "text-on-screen" | "tutorial format" | "before/after" | "storytime"

Return ONLY valid JSON — no explanation, no markdown. Schema:
{
  "ideas": [
    {
      "title": "short punchy name for this content format",
      "concept": "2-sentence description of what this video is",
      "hookLine": "the exact first 5-8 words to open the video",
      "shootBrief": "3-4 sentences: what to film, camera angle, pacing, text overlays needed",
      "whyItWillWork": "1-2 sentences citing their specific data — why this will outperform their average",
      "format": "talking head 15-30s",
      "estimatedBoost": "+20-35% saves vs your avg"
    }
  ]
}`;

  const message = await anthropic.messages.create({
    model:      "claude-haiku-4-5",
    max_tokens: 3000,
    messages:   [{ role: "user", content: prompt }],
  });

  const text = (message.content[0] as { text: string }).text.trim();

  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: { ideas: ContentIdea[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Claude response: ${text.slice(0, 200)}`);
  }

  return (parsed.ideas || []).slice(0, 5);
}
