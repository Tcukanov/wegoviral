import Anthropic from "@anthropic-ai/sdk";
import { TrendingReel, TrendingAnalysis } from "@prisma/client";
import { prisma } from "../../prisma/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ClaudeTrendingResult {
  tldr: string;
  whyItWentViral: string;
  hookAnalysis: string;
  retentionDevice: string;
  sendTrigger: string;
  saveTrigger: string;
  audioStrategy: string;
  captionStrategy: string;
  formatBreakdown: { length: string; style: string; pacing: string };
  emotionTriggers: string[];
  replicationPrompt: string;
  adaptationTips: string[];
  nicheFitCategories: string[];
  viralWindow: string;
}

export async function generateTrendingAnalysis(
  reel: TrendingReel
): Promise<TrendingAnalysis> {
  const prompt = `Analyze why this Instagram Reel went viral. Return ONLY valid JSON with no markdown, no backticks, no explanation outside the JSON:

{
  "tldr": "One punchy sentence why it went viral (max 15 words)",
  "whyItWentViral": "3 paragraphs: psychology, format, timing",
  "hookAnalysis": "First 3 seconds breakdown",
  "retentionDevice": "Why people watch to the end",
  "sendTrigger": "Why people DM this to friends",
  "saveTrigger": "Why people save this",
  "audioStrategy": "How audio contributed to virality",
  "captionStrategy": "Caption/hashtag analysis",
  "formatBreakdown": {
    "length": "why this duration works",
    "style": "raw|polished|etc and why",
    "pacing": "editing pace analysis"
  },
  "emotionTriggers": ["emotion1", "emotion2"],
  "replicationPrompt": "Complete copy-ready brief to recreate this. Min 100 words. Include hook, format, duration, audio tip, caption.",
  "adaptationTips": ["fitness creator tip", "finance creator tip", "food creator tip"],
  "nicheFitCategories": ["niche1", "niche2"],
  "viralWindow": "peaking-now|rising|peaked-recently|fading"
}

Reel data:
Username: @${reel.username}
Caption: ${reel.caption}
Hashtags: ${reel.hashtags.join(" ")}
Audio: ${reel.audioName || "Original audio"}
Trending Audio: ${reel.isAudioTrending}
Views: ${reel.views.toLocaleString()}
Likes: ${reel.likes.toLocaleString()}
Comments: ${reel.comments.toLocaleString()}
Duration: ${reel.duration}s
Category: ${reel.category}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system:
      "You are a viral content strategist. Analyze why this Reel went viral. Return ONLY valid JSON.",
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content.find((c) => c.type === "text")?.text?.trim() ?? "";

  let parsed: ClaudeTrendingResult;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    throw new Error(`Failed to parse Claude response: ${text.slice(0, 200)}`);
  }

  return prisma.trendingAnalysis.upsert({
    where: { reelId: reel.id },
    create: {
      reelId: reel.id,
      tldr: parsed.tldr,
      whyItWentViral: parsed.whyItWentViral,
      hookAnalysis: parsed.hookAnalysis,
      retentionDevice: parsed.retentionDevice,
      sendTrigger: parsed.sendTrigger,
      saveTrigger: parsed.saveTrigger,
      audioStrategy: parsed.audioStrategy,
      captionStrategy: parsed.captionStrategy,
      formatBreakdown: parsed.formatBreakdown,
      emotionTriggers: parsed.emotionTriggers,
      replicationPrompt: parsed.replicationPrompt,
      adaptationTips: parsed.adaptationTips,
      nicheFitCategories: parsed.nicheFitCategories,
      viralWindow: parsed.viralWindow,
    },
    update: {
      tldr: parsed.tldr,
      whyItWentViral: parsed.whyItWentViral,
      hookAnalysis: parsed.hookAnalysis,
      retentionDevice: parsed.retentionDevice,
      sendTrigger: parsed.sendTrigger,
      saveTrigger: parsed.saveTrigger,
      audioStrategy: parsed.audioStrategy,
      captionStrategy: parsed.captionStrategy,
      formatBreakdown: parsed.formatBreakdown,
      emotionTriggers: parsed.emotionTriggers,
      replicationPrompt: parsed.replicationPrompt,
      adaptationTips: parsed.adaptationTips,
      nicheFitCategories: parsed.nicheFitCategories,
      viralWindow: parsed.viralWindow,
    },
  });
}
