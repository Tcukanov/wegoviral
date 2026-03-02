/**
 * Instagram Graph API Service
 *
 * Wraps Facebook's Graph API to access Instagram Business/Creator account data.
 * Requires a Facebook App with instagram_basic + instagram_manage_insights permissions.
 *
 * Auth flow:
 *   1. User authorizes via Facebook OAuth → we get a short-lived user token
 *   2. Exchange for long-lived user token (60 days)
 *   3. Get user's Facebook Pages → find connected Instagram Business Account
 *   4. Use the Page access token for all subsequent Graph API calls
 */

const GRAPH_API = "https://graph.facebook.com/v19.0";

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
  // filled in after insights call
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

export interface TokenExchangeResult {
  userAccessToken: string;
  pageAccessToken: string;
  igAccountId: string;
  profile: IGProfile;
  expiresAt: Date | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function graphFetch<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_API}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  const json = await res.json() as T & { error?: { message: string; code: number } };

  if ((json as { error?: { message: string } }).error) {
    const err = (json as { error: { message: string; code: number } }).error;
    throw new Error(`Graph API error (${err.code}): ${err.message}`);
  }
  return json;
}

// ─── OAuth token exchange ─────────────────────────────────────────────────────

/** Exchange short-lived code for a short-lived user access token */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{ access_token: string; token_type: string }> {
  const appId = process.env.FB_APP_ID!;
  const appSecret = process.env.FB_APP_SECRET!;
  const url = new URL(`${GRAPH_API}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const json = await res.json() as { access_token: string; token_type: string; error?: { message: string } };
  if (json.error) throw new Error(`Token exchange failed: ${json.error.message}`);
  return json;
}

/** Exchange short-lived token for long-lived token (60 days) */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ access_token: string; expires_in: number }> {
  const appId = process.env.FB_APP_ID!;
  const appSecret = process.env.FB_APP_SECRET!;
  const url = new URL(`${GRAPH_API}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString());
  const json = await res.json() as { access_token: string; expires_in: number; error?: { message: string } };
  if (json.error) throw new Error(`Long-lived token exchange failed: ${json.error.message}`);
  return json;
}

// ─── Account discovery ────────────────────────────────────────────────────────

/** Get the user's Facebook Pages + linked Instagram Business Accounts */
async function getInstagramAccountFromPages(userToken: string): Promise<{ igAccountId: string; pageAccessToken: string } | null> {
  const pagesRes = await graphFetch<{ data: { id: string; access_token: string }[] }>(
    "/me/accounts",
    userToken,
    { fields: "id,name,access_token" }
  );

  for (const page of pagesRes.data) {
    try {
      const igRes = await graphFetch<{ instagram_business_account?: { id: string } }>(
        `/${page.id}`,
        page.access_token,
        { fields: "instagram_business_account" }
      );
      if (igRes.instagram_business_account?.id) {
        return {
          igAccountId: igRes.instagram_business_account.id,
          pageAccessToken: page.access_token,
        };
      }
    } catch {
      // this page has no linked IG account, continue
    }
  }
  return null;
}

// ─── Full OAuth flow ──────────────────────────────────────────────────────────

/**
 * Complete the OAuth flow: code → tokens → IG account → profile
 * Returns everything needed to store in ConnectedAccount
 */
export async function completeOAuthFlow(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  // 1. Get short-lived user token
  const { access_token: shortLived } = await exchangeCodeForToken(code, redirectUri);

  // 2. Get long-lived user token
  const { access_token: userAccessToken, expires_in } = await exchangeForLongLivedToken(shortLived);
  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

  // 3. Find Instagram Business Account via Facebook Pages
  const igInfo = await getInstagramAccountFromPages(userAccessToken);
  if (!igInfo) {
    throw new Error(
      "No Instagram Business or Creator account linked to your Facebook Pages. " +
      "Convert your account to Business/Creator in Instagram settings, then link it to a Facebook Page."
    );
  }

  const { igAccountId, pageAccessToken } = igInfo;

  // 4. Get Instagram profile
  const profile = await getIGProfile(igAccountId, pageAccessToken);

  return { userAccessToken, pageAccessToken, igAccountId, profile, expiresAt };
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────

export async function getIGProfile(igAccountId: string, token: string): Promise<IGProfile> {
  return graphFetch<IGProfile>(
    `/${igAccountId}`,
    token,
    { fields: "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url" }
  );
}

export async function getIGMedia(igAccountId: string, token: string, limit = 20): Promise<IGMedia[]> {
  const res = await graphFetch<{ data: IGMedia[] }>(
    `/${igAccountId}/media`,
    token,
    {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: String(limit),
    }
  );
  return res.data;
}

/** Fetch per-post insights (impressions, reach, saves, video_views) */
async function getMediaInsights(mediaId: string, mediaType: IGMedia["media_type"], token: string): Promise<Partial<IGMedia>> {
  const metricsForType = mediaType === "VIDEO"
    ? "impressions,reach,saved,video_views,shares"
    : "impressions,reach,saved";

  try {
    const res = await graphFetch<{ data: { name: string; values: { value: number }[] }[] }>(
      `/${mediaId}/insights`,
      token,
      { metric: metricsForType }
    );
    const out: Partial<IGMedia> = {};
    for (const m of res.data) {
      const v = m.values?.[0]?.value ?? 0;
      if (m.name === "impressions")  out.impressions  = v;
      if (m.name === "reach")        out.reach        = v;
      if (m.name === "saved")        out.saved        = v;
      if (m.name === "video_views")  out.video_views  = v;
      if (m.name === "shares")       out.shares       = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Enrich a media list with insights (parallel fetches) */
export async function enrichMediaWithInsights(media: IGMedia[], token: string): Promise<IGMedia[]> {
  const withInsights = await Promise.all(
    media.map(async (post) => {
      const insights = await getMediaInsights(post.id, post.media_type, token);
      return { ...post, ...insights };
    })
  );
  return withInsights;
}

/** Account-level insights for last 7 days */
export async function getAccountInsights(igAccountId: string, token: string): Promise<IGAccountInsights> {
  const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);

  const defaultInsights: IGAccountInsights = { impressions7d: 0, reach7d: 0, profileViews7d: 0, followerDelta7d: 0 };

  try {
    const res = await graphFetch<{ data: { name: string; values: { value: number }[] }[] }>(
      `/${igAccountId}/insights`,
      token,
      {
        metric: "impressions,reach,profile_views",
        period: "day",
        since: String(since),
        until: String(until),
      }
    );

    const sum = (values: { value: number }[]) => values.reduce((a, b) => a + b.value, 0);
    for (const m of res.data) {
      if (m.name === "impressions")   defaultInsights.impressions7d   = sum(m.values);
      if (m.name === "reach")         defaultInsights.reach7d         = sum(m.values);
      if (m.name === "profile_views") defaultInsights.profileViews7d  = sum(m.values);
    }
  } catch {
    // insights may fail for new/limited accounts — return zeros
  }

  return defaultInsights;
}
