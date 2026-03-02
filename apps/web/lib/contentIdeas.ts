import Anthropic from "@anthropic-ai/sdk";
import type { IGMedia } from "./graphApi";

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

function engagementRate(m: IGMedia): number {
  const base = m.impressions || m.reach || 1;
  return ((m.like_count + m.comments_count + (m.saved ?? 0)) / base) * 100;
}

function summarizePost(post: IGMedia) {
  return {
    type:           post.media_type,
    caption:        (post.caption || "").slice(0, 200),
    likes:          post.like_count,
    comments:       post.comments_count,
    saves:          post.saved ?? 0,
    impressions:    post.impressions ?? 0,
    reach:          post.reach ?? 0,
    videoViews:     post.video_views ?? 0,
    engagementRate: parseFloat(engagementRate(post).toFixed(2)),
    postedAt:       post.timestamp,
  };
}

export async function generateContentIdeas(
  username: string,
  followers: number,
  bio: string,
  media: IGMedia[]
): Promise<ContentIdea[]> {
  const sorted  = [...media].sort((a, b) => engagementRate(b) - engagementRate(a));
  const top5    = sorted.slice(0, 5).map(summarizePost);
  const bottom5 = sorted.slice(-5).map(summarizePost);
  const videos  = media.filter(m => m.media_type === "VIDEO");
  const avgLikes  = Math.round(media.reduce((s, m) => s + m.like_count, 0) / Math.max(media.length, 1));
  const avgSaves  = Math.round(media.reduce((s, m) => s + (m.saved ?? 0), 0) / Math.max(media.length, 1));
  const avgImpres = Math.round(media.reduce((s, m) => s + (m.impressions ?? 0), 0) / Math.max(media.length, 1));

  const prompt = `You are a top-tier social media content strategist. Analyze this creator's actual performance data and generate 5 highly specific, immediately actionable content ideas.

ACCOUNT: @${username} | ${followers.toLocaleString()} followers
BIO: ${bio || "(no bio)"}
TOTAL POSTS ANALYZED: ${media.length}
ACCOUNT AVERAGES: ${avgLikes} likes/post · ${avgSaves} saves/post · ${avgImpres.toLocaleString()} impressions/post

TOP 5 PERFORMING POSTS (sorted by engagement rate):
${JSON.stringify(top5, null, 2)}

BOTTOM 5 POSTS (what's NOT working):
${JSON.stringify(bottom5, null, 2)}

CONTENT MIX: ${videos.length} videos out of ${media.length} total posts

RULES:
1. Every idea must be rooted in their actual data — reference specific numbers
2. BANNED phrases: "consider", "leverage", "optimize", "engage", "resonate"
3. Each idea must be immediately executable — no vague suggestions
4. The hookLine is the exact first words to say/show on camera
5. Format types: "talking head 15-30s" | "voiceover B-roll" | "text-on-screen" | "tutorial format" | "before/after" | "storytime"

Return ONLY valid JSON — no explanation, no markdown fences:
{
  "ideas": [
    {
      "title": "short punchy name for this format",
      "concept": "2-sentence description of what this video is",
      "hookLine": "exact first 5-8 words to open the video",
      "shootBrief": "3-4 sentences: what to film, camera angle, pacing, text overlays",
      "whyItWillWork": "1-2 sentences citing their specific data",
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

  const text    = (message.content[0] as { text: string }).text.trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const parsed = JSON.parse(cleaned) as { ideas: ContentIdea[] };
  return (parsed.ideas || []).slice(0, 5);
}
