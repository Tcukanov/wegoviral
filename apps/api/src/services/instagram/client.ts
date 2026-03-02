/**
 * Instagram Internal API Client
 *
 * Makes direct HTTP requests to Instagram's web API endpoints using
 * session cookies. Same endpoints that instagram.com uses in the browser.
 *
 * Required env vars: IG_SESSION_ID, IG_CSRF_TOKEN, IG_DS_USER_ID
 *
 * HOW TO GET YOUR SESSION COOKIES:
 *   1. Open Instagram.com in Chrome, log in
 *   2. Open DevTools → Application → Cookies → instagram.com
 *   3. Copy values for: sessionid, csrftoken, ds_user_id
 *   4. Paste them into .env
 */

import {
  InstagramSession,
  IGClipsTrendingResponse,
  IGHashtagSectionResponse,
  IGUserReelsResponse,
  IGMediaInfoResponse,
  IGWebProfileResponse,
} from "./types";

const IG_WEB_APP_ID = "936619743392459";
const BASE = "https://www.instagram.com";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class InstagramClient {
  private session: InstagramSession;
  private lastRequestAt = 0;
  private minDelayMs = 2500;
  private maxRetries = 3;

  constructor(session: InstagramSession) {
    this.session = session;
  }

  static fromEnv(): InstagramClient {
    const sessionId = process.env.IG_SESSION_ID;
    const csrfToken = process.env.IG_CSRF_TOKEN;
    const dsUserId = process.env.IG_DS_USER_ID;

    if (!sessionId || !csrfToken || !dsUserId) {
      throw new Error(
        "Missing Instagram session cookies.\n" +
          "Set IG_SESSION_ID, IG_CSRF_TOKEN, IG_DS_USER_ID in your .env file.\n\n" +
          "To get them:\n" +
          "  1. Open instagram.com in Chrome, log in\n" +
          "  2. DevTools → Application → Cookies → instagram.com\n" +
          "  3. Copy: sessionid, csrftoken, ds_user_id\n"
      );
    }

    return new InstagramClient({ sessionId, csrfToken, dsUserId });
  }

  private get headers(): Record<string, string> {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    return {
      "User-Agent": ua,
      "X-CSRFToken": this.session.csrfToken,
      "X-IG-App-ID": IG_WEB_APP_ID,
      "X-Requested-With": "XMLHttpRequest",
      "X-IG-WWW-Claim": "0",
      Referer: `${BASE}/`,
      Origin: BASE,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "*/*",
      Cookie: [
        `sessionid=${this.session.sessionId}`,
        `csrftoken=${this.session.csrfToken}`,
        `ds_user_id=${this.session.dsUserId}`,
      ].join("; "),
    };
  }

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelayMs) {
      const jitter = Math.random() * 1000;
      await sleep(this.minDelayMs - elapsed + jitter);
    }
    this.lastRequestAt = Date.now();
  }

  private async request<T>(
    url: string,
    init: RequestInit = {},
    attempt = 1
  ): Promise<T> {
    await this.rateLimit();

    const res = await fetch(url, {
      ...init,
      headers: {
        ...this.headers,
        ...(init.headers as Record<string, string>),
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "SESSION_EXPIRED: Your Instagram session has expired. " +
          "Re-extract cookies from your browser and update .env"
      );
    }

    if (res.status === 429) {
      if (attempt <= this.maxRetries) {
        const backoff = Math.pow(2, attempt) * 5000;
        console.warn(
          `[IG] Rate limited. Waiting ${backoff / 1000}s (attempt ${attempt}/${this.maxRetries})...`
        );
        await sleep(backoff);
        return this.request<T>(url, init, attempt + 1);
      }
      throw new Error("RATE_LIMITED: Instagram rate limit exceeded after retries.");
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Instagram API ${res.status}: ${res.statusText} — ${url.split("?")[0]} ${body.slice(0, 200)}`
      );
    }

    return res.json() as Promise<T>;
  }

  // ─── Trending Reels ──────────────────────────────────────────────────────────

  async getTrendingReels(maxId?: string): Promise<IGClipsTrendingResponse> {
    const body: Record<string, string> = {};
    if (maxId) body.max_id = maxId;

    return this.request<IGClipsTrendingResponse>(
      `${BASE}/api/v1/clips/trending/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      }
    );
  }

  // ─── Hashtag Feed ────────────────────────────────────────────────────────────

  async getHashtagFeed(
    hashtag: string,
    tab: "top" | "recent" = "top"
  ): Promise<IGHashtagSectionResponse> {
    return this.request<IGHashtagSectionResponse>(
      `${BASE}/api/v1/tags/${encodeURIComponent(hashtag)}/sections/?tab=${tab}`
    );
  }

  // ─── User Reels ──────────────────────────────────────────────────────────────

  async getUserReels(
    userId: string,
    maxId?: string
  ): Promise<IGUserReelsResponse> {
    const body: Record<string, string> = {
      target_user_id: userId,
      page_size: "12",
    };
    if (maxId) body.max_id = maxId;

    return this.request<IGUserReelsResponse>(`${BASE}/api/v1/clips/user/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
  }

  // ─── Single Post Info ────────────────────────────────────────────────────────

  async getMediaInfo(mediaId: string): Promise<IGMediaInfoResponse> {
    return this.request<IGMediaInfoResponse>(
      `${BASE}/api/v1/media/${mediaId}/info/`
    );
  }

  // ─── Resolve username → numeric user ID ──────────────────────────────────────

  async getUserId(username: string): Promise<string> {
    const data = await this.request<IGWebProfileResponse>(
      `${BASE}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
    );
    return data.data.user.id;
  }

  // ─── Get user profile info (id + follower count) ─────────────────────────────

  async getUserProfile(
    username: string
  ): Promise<{ userId: string; followerCount: number | null }> {
    const data = await this.request<IGWebProfileResponse>(
      `${BASE}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
    );
    const user = data.data.user;
    const followerCount =
      user.edge_followed_by?.count ?? user.follower_count ?? null;
    return { userId: user.id, followerCount };
  }

  // ─── Health check (verify session is valid) ──────────────────────────────────

  async verifySession(): Promise<boolean> {
    try {
      await this.request<unknown>(
        `${BASE}/api/v1/accounts/current_user/?edit=true`
      );
      return true;
    } catch {
      return false;
    }
  }
}
