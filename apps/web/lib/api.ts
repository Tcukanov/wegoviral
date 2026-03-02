import axios from "axios";
import type {
  TrendingReel,
  TrendingAnalysis,
  UserPostAnalysisResponse,
  StatsResponse,
} from "@wegoviral/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  withCredentials: true,
});

export interface TrendingFeedParams {
  category?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface TrendingFeedResult {
  reels: TrendingReel[];
  total: number;
  hasMore: boolean;
}

export async function fetchTrendingFeed(
  params: TrendingFeedParams = {}
): Promise<TrendingFeedResult> {
  const { data } = await api.get("/api/trending", { params });
  return data;
}

export async function fetchTrendingReel(id: string): Promise<TrendingReel> {
  const { data } = await api.get(`/api/trending/${id}`);
  return data;
}

export async function fetchReelAnalysis(
  reelId: string
): Promise<TrendingAnalysis | { pending: true }> {
  const { data } = await api.get(`/api/trending/${reelId}/analysis`);
  return data;
}

export async function analyzeInstagramUrl(
  url: string
): Promise<UserPostAnalysisResponse> {
  const { data } = await api.post("/api/analyze-url", { url });
  return data;
}

export async function fetchStats(): Promise<StatsResponse> {
  const { data } = await api.get("/api/admin/stats");
  return data;
}

export interface ViralExample {
  shortcode: string;
  url: string;
  username: string;
  views: number;
  likes: number;
  viralScore: number;
  category: string;
  followerCount: number | null;
  caption: string;
}

export interface ViralExamplesResult {
  matched: boolean;
  examples: ViralExample[];
  category?: string;
}

export async function fetchViralExamples(category?: string): Promise<ViralExamplesResult> {
  const { data } = await api.get("/api/trending/top-viral", {
    params: category ? { category } : {},
  });
  return data;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 65) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function getScoreBg(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 65) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export function getViralScoreColor(score: number): string {
  if (score >= 90) return "bg-red-500 text-white";
  if (score >= 70) return "bg-orange-500 text-white";
  if (score >= 50) return "bg-yellow-500 text-black";
  return "bg-zinc-600 text-white";
}

// ─── Dashboard / Connected Account ───────────────────────────────────────────

export interface IGProfile {
  id: string;
  username: string;
  name: string;
  biography: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  profile_picture_url: string;
}

export interface IGMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
  impressions?: number;
  reach?: number;
  saved?: number;
  video_views?: number;
  shares?: number;
}

export interface IGAccountInsights {
  impressions7d: number;
  reach7d: number;
  profileViews7d: number;
  followerDelta7d: number;
}

export interface ContentIdea {
  title: string;
  concept: string;
  hookLine: string;
  shootBrief: string;
  whyItWillWork: string;
  format: string;
  estimatedBoost: string;
}

export async function fetchDashboardMe(): Promise<{ connected: boolean; profile: IGProfile }> {
  const { data } = await api.get("/auth/instagram/me");
  return data;
}

export async function fetchDashboardMedia(limit = 20): Promise<{ media: IGMedia[] }> {
  const { data } = await api.get("/auth/instagram/media", { params: { limit } });
  return data;
}

export async function fetchDashboardInsights(): Promise<{ insights: IGAccountInsights }> {
  const { data } = await api.get("/auth/instagram/insights");
  return data;
}

export async function generateContentIdeas(media: IGMedia[]): Promise<{ ideas: ContentIdea[] }> {
  const { data } = await api.post("/auth/instagram/ideas", { media });
  return data;
}

export async function disconnectInstagram(): Promise<void> {
  await api.delete("/auth/instagram/disconnect");
}

export function getConnectUrl(): string {
  return `${API_URL}/auth/instagram`;
}

export function getVerdictMeta(score: number): {
  label: string;
  emoji: string;
  bg: string;
  text: string;
} {
  if (score >= 81)
    return {
      label: "Strong Post — Minor Tweaks Needed",
      emoji: "✨",
      bg: "bg-green-500/20",
      text: "text-green-400",
    };
  if (score >= 66)
    return {
      label: "Close — A Few Fixes Will Help",
      emoji: "🔥",
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
    };
  if (score >= 41)
    return {
      label: "Some Potential Here",
      emoji: "📈",
      bg: "bg-orange-500/20",
      text: "text-orange-400",
    };
  return {
    label: "Needs Major Work",
    emoji: "⚠️",
    bg: "bg-red-500/20",
    text: "text-red-400",
  };
}
