/**
 * Instagram Business Login API
 *
 * Uses the modern Instagram OAuth flow (not Facebook Login):
 *   Auth URL:      https://www.instagram.com/oauth/authorize
 *   Token URL:     https://api.instagram.com/oauth/access_token
 *   Long-lived:    https://graph.instagram.com/access_token
 *   API base:      https://graph.instagram.com
 *
 * Required scopes: instagram_business_basic, instagram_business_manage_insights
 */

const IG_AUTH_API  = "https://api.instagram.com";
const GRAPH_API    = "https://graph.instagram.com";

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface OAuthResult {
  accessToken: string;
  igAccountId: string;
  profile: IGProfile;
  expiresAt: Date | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function graphFetch<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_API}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res  = await fetch(url.toString());
  const json = await res.json() as T & { error?: { message: string; code: number } };
  if ((json as { error?: { message: string } }).error) {
    throw new Error(`Instagram API: ${(json as { error: { message: string } }).error.message}`);
  }
  return json;
}

// ─── OAuth flow ───────────────────────────────────────────────────────────────

export function buildOAuthUrl(redirectUri: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id",     process.env.FB_APP_ID!);
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("scope",         "instagram_business_basic,instagram_business_manage_insights");
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function completeOAuthFlow(code: string, redirectUri: string): Promise<OAuthResult> {
  // 1. Exchange code for short-lived token
  const body = new URLSearchParams({
    client_id:     process.env.FB_APP_ID!,
    client_secret: process.env.FB_APP_SECRET!,
    grant_type:    "authorization_code",
    redirect_uri:  redirectUri,
    code,
  });

  const tokenRes  = await fetch(`${IG_AUTH_API}/oauth/access_token`, {
    method:  "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const tokenData = await tokenRes.json() as {
    access_token?: string; user_id?: number;
    error?: { message: string };
  };
  if (tokenData.error || !tokenData.access_token) {
    throw new Error(tokenData.error?.message || "Token exchange failed");
  }

  // 2. Exchange for long-lived token (60 days)
  const llUrl = new URL(`${GRAPH_API}/access_token`);
  llUrl.searchParams.set("grant_type",    "ig_exchange_token");
  llUrl.searchParams.set("client_id",     process.env.FB_APP_ID!);
  llUrl.searchParams.set("client_secret", process.env.FB_APP_SECRET!);
  llUrl.searchParams.set("access_token",  tokenData.access_token);

  const llRes  = await fetch(llUrl.toString());
  const llData = await llRes.json() as {
    access_token?: string; expires_in?: number; error?: { message: string };
  };
  if (llData.error || !llData.access_token) {
    throw new Error(llData.error?.message || "Long-lived token exchange failed");
  }

  const accessToken = llData.access_token;
  const expiresAt   = llData.expires_in ? new Date(Date.now() + llData.expires_in * 1000) : null;
  const profile     = await getIGProfile(accessToken);

  return { accessToken, igAccountId: profile.id, profile, expiresAt };
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────

export async function getIGProfile(token: string): Promise<IGProfile> {
  return graphFetch<IGProfile>("/me", token, {
    fields: "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url",
  });
}

export async function getIGMedia(token: string, limit = 20): Promise<IGMedia[]> {
  const res = await graphFetch<{ data: IGMedia[] }>("/me/media", token, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit:  String(limit),
  });
  return res.data;
}

async function getMediaInsights(mediaId: string, mediaType: IGMedia["media_type"], token: string): Promise<Partial<IGMedia>> {
  const metrics = mediaType === "VIDEO"
    ? "impressions,reach,saved,video_views,total_interactions"
    : "impressions,reach,saved,total_interactions";

  try {
    const res = await graphFetch<{ data: { name: string; values?: { value: number }[]; value?: number }[] }>(
      `/${mediaId}/insights`, token, { metric: metrics }
    );
    const out: Partial<IGMedia> = {};
    for (const m of res.data) {
      const v = m.value ?? m.values?.[0]?.value ?? 0;
      if (m.name === "impressions")        out.impressions  = v;
      if (m.name === "reach")              out.reach        = v;
      if (m.name === "saved")              out.saved        = v;
      if (m.name === "video_views")        out.video_views  = v;
      if (m.name === "total_interactions") out.shares       = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function enrichMediaWithInsights(media: IGMedia[], token: string): Promise<IGMedia[]> {
  return Promise.all(media.map(async post => ({
    ...post,
    ...(await getMediaInsights(post.id, post.media_type, token)),
  })));
}

export async function getAccountInsights(token: string): Promise<IGAccountInsights> {
  const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);
  const result: IGAccountInsights = { impressions7d: 0, reach7d: 0, profileViews7d: 0, followerDelta7d: 0 };

  try {
    const res = await graphFetch<{ data: { name: string; values: { value: number }[] }[] }>(
      "/me/insights", token, {
        metric: "impressions,reach,profile_views",
        period: "day",
        since:  String(since),
        until:  String(until),
      }
    );
    const sum = (vals: { value: number }[]) => vals.reduce((a, b) => a + b.value, 0);
    for (const m of res.data) {
      if (m.name === "impressions")   result.impressions7d   = sum(m.values);
      if (m.name === "reach")         result.reach7d         = sum(m.values);
      if (m.name === "profile_views") result.profileViews7d  = sum(m.values);
    }
  } catch { /* insights may not be available for all accounts */ }

  return result;
}
