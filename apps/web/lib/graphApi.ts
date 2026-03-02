/**
 * Instagram Graph API via Facebook Login
 *
 * OAuth flow: Facebook OAuth → get user's FB Pages → find linked Instagram Business Account
 * This path gives full insights (reach, impressions, saves) — the Instagram Login path does not.
 *
 * Auth URL:   https://www.facebook.com/v19.0/dialog/oauth
 * Token URL:  https://graph.facebook.com/v19.0/oauth/access_token
 * API base:   https://graph.facebook.com/v19.0
 *
 * Required scopes: instagram_basic, pages_show_list, instagram_manage_insights
 */

const FB_GRAPH = "https://graph.facebook.com/v19.0";

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
  accessToken: string;   // page access token (used for all IG Graph API calls)
  igAccountId: string;
  profile: IGProfile;
  expiresAt: Date | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fbFetch<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FB_GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res  = await fetch(url.toString());
  const json = await res.json() as T & { error?: { message: string; code: number } };
  if ((json as { error?: { message: string } }).error) {
    throw new Error(`Graph API: ${(json as { error: { message: string } }).error.message}`);
  }
  return json;
}

// ─── OAuth URL ────────────────────────────────────────────────────────────────

export function buildOAuthUrl(redirectUri: string): string {
  const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  url.searchParams.set("client_id",     process.env.FB_APP_ID!);
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("scope",         "instagram_basic,pages_show_list,instagram_manage_insights");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state",         "wgv");
  return url.toString();
}

// ─── OAuth flow ───────────────────────────────────────────────────────────────

export async function completeOAuthFlow(code: string, redirectUri: string): Promise<OAuthResult> {
  // 1. Exchange code for short-lived user token
  const tokenUrl = new URL(`${FB_GRAPH}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id",     process.env.FB_APP_ID!);
  tokenUrl.searchParams.set("client_secret", process.env.FB_APP_SECRET!);
  tokenUrl.searchParams.set("redirect_uri",  redirectUri);
  tokenUrl.searchParams.set("code",          code);

  const tokenRes  = await fetch(tokenUrl.toString());
  const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } };
  if (!tokenData.access_token) throw new Error(tokenData.error?.message || "Token exchange failed");

  // 2. Exchange for long-lived user token (60 days)
  const llUrl = new URL(`${FB_GRAPH}/oauth/access_token`);
  llUrl.searchParams.set("grant_type",      "fb_exchange_token");
  llUrl.searchParams.set("client_id",       process.env.FB_APP_ID!);
  llUrl.searchParams.set("client_secret",   process.env.FB_APP_SECRET!);
  llUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

  const llRes  = await fetch(llUrl.toString());
  const llData = await llRes.json() as { access_token?: string; expires_in?: number; error?: { message: string } };
  if (!llData.access_token) throw new Error(llData.error?.message || "Long-lived token exchange failed");

  const userToken = llData.access_token;
  const expiresAt = llData.expires_in ? new Date(Date.now() + llData.expires_in * 1000) : null;

  // 3. Find Instagram Business Account via Facebook Pages
  const pagesRes = await fbFetch<{ data: { id: string; access_token: string }[] }>(
    "/me/accounts", userToken, { fields: "id,name,access_token" }
  );

  let accessToken = userToken;
  let igAccountId = "";

  for (const page of pagesRes.data) {
    try {
      const igRes = await fbFetch<{ instagram_business_account?: { id: string } }>(
        `/${page.id}`, page.access_token, { fields: "instagram_business_account" }
      );
      if (igRes.instagram_business_account?.id) {
        igAccountId = igRes.instagram_business_account.id;
        accessToken = page.access_token; // page token for all subsequent calls
        break;
      }
    } catch { continue; }
  }

  if (!igAccountId) {
    throw new Error(
      "No Instagram Business or Creator account found. " +
      "Make sure your Instagram is set to Business/Creator and linked to a Facebook Page."
    );
  }

  // 4. Get Instagram profile
  const profile = await getIGProfile(igAccountId, accessToken);
  return { accessToken, igAccountId, profile, expiresAt };
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────

export async function getIGProfile(igAccountId: string, token: string): Promise<IGProfile> {
  return fbFetch<IGProfile>(`/${igAccountId}`, token, {
    fields: "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url",
  });
}

export async function getIGMedia(igAccountId: string, token: string, limit = 20): Promise<IGMedia[]> {
  const res = await fbFetch<{ data: IGMedia[] }>(`/${igAccountId}/media`, token, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit:  String(limit),
  });
  return res.data;
}

async function getMediaInsights(mediaId: string, mediaType: IGMedia["media_type"], token: string): Promise<Partial<IGMedia>> {
  const metrics = mediaType === "VIDEO" ? "impressions,reach,saved,video_views" : "impressions,reach,saved";
  try {
    const res = await fbFetch<{ data: { name: string; values: { value: number }[] }[] }>(
      `/${mediaId}/insights`, token, { metric: metrics }
    );
    const out: Partial<IGMedia> = {};
    for (const m of res.data) {
      const v = m.values?.[0]?.value ?? 0;
      if (m.name === "impressions") out.impressions = v;
      if (m.name === "reach")       out.reach       = v;
      if (m.name === "saved")       out.saved       = v;
      if (m.name === "video_views") out.video_views = v;
    }
    return out;
  } catch { return {}; }
}

export async function enrichMediaWithInsights(media: IGMedia[], token: string): Promise<IGMedia[]> {
  return Promise.all(media.map(async post => ({
    ...post,
    ...(await getMediaInsights(post.id, post.media_type, token)),
  })));
}

export async function getAccountInsights(igAccountId: string, token: string): Promise<IGAccountInsights> {
  const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);
  const result: IGAccountInsights = { impressions7d: 0, reach7d: 0, profileViews7d: 0, followerDelta7d: 0 };

  try {
    const res = await fbFetch<{ data: { name: string; values: { value: number }[] }[] }>(
      `/${igAccountId}/insights`, token, {
        metric: "impressions,reach,profile_views",
        period: "day",
        since:  String(since),
        until:  String(until),
      }
    );
    const sum = (vals: { value: number }[]) => vals.reduce((a, b) => a + b.value, 0);
    for (const m of res.data) {
      if (m.name === "impressions")   result.impressions7d  = sum(m.values);
      if (m.name === "reach")         result.reach7d        = sum(m.values);
      if (m.name === "profile_views") result.profileViews7d = sum(m.values);
    }
  } catch { /* insights unavailable for some accounts */ }

  return result;
}
