// ─── Enums ────────────────────────────────────────────────────────────────────

export type Category =
  | "fitness"
  | "finance"
  | "food"
  | "beauty"
  | "motivation"
  | "comedy"
  | "other";

export type SortOption = "viralScore" | "views" | "createdAt";
export type ViralWindow = "peaking-now" | "rising" | "peaked-recently" | "fading";

// ─── Trending Reels ───────────────────────────────────────────────────────────

export interface TrendingReel {
  id: string;
  instagramId: string;
  url: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  thumbnailUrl: string;
  caption: string;
  hashtags: string[];
  audioName?: string | null;
  isAudioTrending: boolean;
  views: number;
  likes: number;
  comments: number;
  duration: number;
  postedAt?: string | null;
  viralScore: number;
  category: string;
  scrapedAt: string;
  analysis?: TrendingAnalysis | null;
}

export interface FormatBreakdown {
  length: string;
  style: string;
  pacing: string;
}

export interface TrendingAnalysis {
  id: string;
  reelId: string;
  tldr: string;
  whyItWentViral: string;
  hookAnalysis: string;
  retentionDevice: string;
  sendTrigger: string;
  saveTrigger: string;
  audioStrategy: string;
  captionStrategy: string;
  formatBreakdown: FormatBreakdown;
  emotionTriggers: string[];
  replicationPrompt: string;
  adaptationTips: string[];
  nicheFitCategories: string[];
  viralWindow: ViralWindow;
  createdAt: string;
}

export interface TrendingFeedResponse {
  reels: TrendingReel[];
  total: number;
  hasMore: boolean;
}

// ─── User Post Analysis ───────────────────────────────────────────────────────

export interface ProbabilityBoost {
  icon: string;
  action: string;
  boost: number;
}

export interface NicheComparison {
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

export interface UserPostAnalysisResponse {
  id: string;
  post: {
    instagramUrl: string;
    username: string;
    thumbnailUrl?: string | null;
    caption: string;
    hashtags: string[];
    audioName?: string | null;
    views: number;
    likes: number;
    comments: number;
    duration: number;
  };
  scores: {
    overall: number;
    hook: number;
    caption: number;
    audio: number;
    format: number;
    engagement: number;
    potentialWithFixes: number;
  };
  benchmark: {
    likeRate: number;
    commentRate: number;
  };
  actual: {
    likeRate: number;
    commentRate: number;
  };
  verdict: string;
  whatWentWrong: string[];
  quickFixes: string[];
  hookFeedback: string;
  captionFeedback: string;
  audioFeedback: string;
  formatFeedback: string;
  rewrittenCaption: string;
  improvedPrompt: string;
  viralProbability: number;
  optimizedProbability: number;
  probabilityBoosts: ProbabilityBoost[];
  nicheComparison: NicheComparison;
  createdAt: string;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface StatsResponse {
  totalAnalyzed: number;
  trendingNow: number;
  topCategory: string;
  lastScraped: string | null;
}
