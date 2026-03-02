// ─── Instagram Internal API Response Types ────────────────────────────────────

export interface InstagramSession {
  sessionId: string;
  csrfToken: string;
  dsUserId: string;
}

// ─── Media node (shared across all endpoints) ────────────────────────────────

export interface IGUser {
  pk: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
}

export interface IGCaption {
  text: string;
}

export interface IGImageCandidate {
  url: string;
  width: number;
  height: number;
}

export interface IGMediaNode {
  id: string;
  pk: string;
  code: string;
  media_type: number; // 1=photo, 2=video, 8=carousel
  caption?: IGCaption | null;
  play_count?: number;
  video_view_count?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  video_duration?: number;
  taken_at: number;
  user: IGUser;
  owner?: IGUser;
  image_versions2?: {
    candidates: IGImageCandidate[];
  };
  thumbnail_src?: string;
  display_url?: string;
  clips_metadata?: {
    original_sound_info?: {
      original_audio_title?: string;
      is_trending_in_clips?: boolean;
    };
    music_info?: {
      music_asset_info?: {
        title?: string;
        is_trending_in_clips?: boolean;
      };
    };
  };
  music_metadata?: {
    music_info?: {
      music_asset_info?: {
        title?: string;
      };
    };
  };
}

// ─── Endpoint responses ──────────────────────────────────────────────────────

export interface IGClipsTrendingResponse {
  items: { media: IGMediaNode }[];
  paging_info: {
    max_id: string | null;
    more_available: boolean;
  };
  status: string;
}

export interface IGHashtagSectionResponse {
  sections: {
    layout_type: string;
    layout_content: {
      medias: { media: IGMediaNode }[];
    };
  }[];
  more_available: boolean;
  next_max_id: string | null;
  status: string;
}

export interface IGUserReelsResponse {
  items: IGMediaNode[];
  paging_info: {
    max_id: string | null;
    more_available: boolean;
  };
  status: string;
}

export interface IGMediaInfoResponse {
  items: IGMediaNode[];
  status: string;
}

export interface IGWebProfileResponse {
  data: {
    user: {
      id: string;
      edge_followed_by?: { count: number };
      follower_count?: number;
    };
  };
}

// ─── Our internal types ──────────────────────────────────────────────────────

export type DiscoverySource = "trending" | "hashtag" | "creator";

export interface DiscoveredReel {
  instagramId: string;
  shortcode: string;
  url: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  thumbnailUrl: string;
  caption: string;
  hashtags: string[];
  audioName: string | null;
  isAudioTrending: boolean;
  views: number;
  likes: number;
  comments: number;
  duration: number;
  postedAt: Date | null;
  source: DiscoverySource;
  followerCount: number | null;
}
