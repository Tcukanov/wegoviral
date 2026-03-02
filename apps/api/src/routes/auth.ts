import { Router, Request, Response } from "express";
import { prisma } from "../prisma/client";
import {
  completeOAuthFlow,
  getIGProfile,
  getIGMedia,
  enrichMediaWithInsights,
  getAccountInsights,
} from "../services/instagram/graphApi";

const router = Router();

const SESSION_COOKIE = "wgv_session";
const COOKIE_MAX_AGE = 60 * 24 * 60 * 60 * 1000; // 60 days in ms

const REDIRECT_URI = process.env.IG_OAUTH_REDIRECT_URI
  || "http://localhost:3001/auth/instagram/callback";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// ─── Helper: get session from cookie ──────────────────────────────────────────

function getSessionId(req: Request): string | null {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

async function getConnectedAccount(req: Request) {
  const sessionId = getSessionId(req);
  if (!sessionId) return null;
  return prisma.connectedAccount.findUnique({ where: { sessionId } });
}

// ─── GET /auth/instagram  →  start OAuth ──────────────────────────────────────

router.get("/instagram", (_req, res: Response) => {
  const appId = process.env.FB_APP_ID;
  if (!appId) {
    res.status(500).json({ error: "FB_APP_ID not configured. See .env for setup instructions." });
    return;
  }

  const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  // instagram_basic + pages_show_list work in Development Mode immediately.
  // instagram_manage_insights requires Advanced Access (app review) — add it after going Live.
  url.searchParams.set("scope", "instagram_basic,pages_show_list,pages_read_engagement");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", "wgv");

  res.redirect(url.toString());
});

// ─── GET /auth/instagram/callback  →  exchange code, store session ───────────

router.get("/instagram/callback", async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error || !code) {
    res.redirect(`${FRONTEND_URL}/dashboard?error=oauth_cancelled`);
    return;
  }

  try {
    const result = await completeOAuthFlow(code as string, REDIRECT_URI);

    const sessionId = crypto.randomUUID();

    // Check if this IG account was connected before (reuse record, update session)
    const existing = await prisma.connectedAccount.findFirst({
      where: { igAccountId: result.igAccountId },
    });

    await prisma.connectedAccount.upsert({
      where: { sessionId: existing?.sessionId ?? sessionId },
      update: {
        sessionId,
        igUsername:     result.profile.username,
        igName:         result.profile.name,
        igBio:          result.profile.biography,
        igFollowers:    result.profile.followers_count,
        igFollowing:    result.profile.follows_count,
        igMediaCount:   result.profile.media_count,
        igProfilePic:   result.profile.profile_picture_url,
        pageAccessToken: result.pageAccessToken,
        userAccessToken: result.userAccessToken,
        expiresAt:      result.expiresAt,
      },
      create: {
        sessionId,
        igAccountId:    result.igAccountId,
        igUsername:     result.profile.username,
        igName:         result.profile.name,
        igBio:          result.profile.biography,
        igFollowers:    result.profile.followers_count,
        igFollowing:    result.profile.follows_count,
        igMediaCount:   result.profile.media_count,
        igProfilePic:   result.profile.profile_picture_url,
        pageAccessToken: result.pageAccessToken,
        userAccessToken: result.userAccessToken,
        expiresAt:      result.expiresAt,
      },
    });

    res.cookie(SESSION_COOKIE, sessionId, {
      maxAge:   COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path:     "/",
    });

    res.redirect(`${FRONTEND_URL}/dashboard?connected=1`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? encodeURIComponent(err.message) : "oauth_error";
    res.redirect(`${FRONTEND_URL}/dashboard?error=${msg}`);
  }
});

// ─── GET /auth/instagram/me  →  return profile ─────────────────────────────

router.get("/instagram/me", async (req: Request, res: Response) => {
  const account = await getConnectedAccount(req);
  if (!account) { res.status(401).json({ error: "not_connected" }); return; }

  // refresh profile in background
  try {
    const profile = await getIGProfile(account.igAccountId, account.pageAccessToken);
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        igFollowers:  profile.followers_count,
        igFollowing:  profile.follows_count,
        igMediaCount: profile.media_count,
        igProfilePic: profile.profile_picture_url,
        igBio:        profile.biography,
      },
    });
    res.json({ connected: true, profile });
  } catch {
    res.json({
      connected: true,
      profile: {
        id:                  account.igAccountId,
        username:            account.igUsername,
        name:                account.igName ?? account.igUsername,
        biography:           account.igBio ?? "",
        followers_count:     account.igFollowers,
        follows_count:       account.igFollowing,
        media_count:         account.igMediaCount,
        profile_picture_url: account.igProfilePic ?? "",
      },
    });
  }
});

// ─── GET /auth/instagram/media  →  posts + insights ──────────────────────────

router.get("/instagram/media", async (req: Request, res: Response) => {
  const account = await getConnectedAccount(req);
  if (!account) { res.status(401).json({ error: "not_connected" }); return; }

  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const media = await getIGMedia(account.igAccountId, account.pageAccessToken, limit);
    const enriched = await enrichMediaWithInsights(media, account.pageAccessToken);
    res.json({ media: enriched });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch media";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /auth/instagram/insights  →  account-level metrics ──────────────────

router.get("/instagram/insights", async (req: Request, res: Response) => {
  const account = await getConnectedAccount(req);
  if (!account) { res.status(401).json({ error: "not_connected" }); return; }

  try {
    const insights = await getAccountInsights(account.igAccountId, account.pageAccessToken);
    res.json({ insights });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch insights";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /auth/instagram/ideas  →  Claude content ideas ──────────────────────

router.post("/instagram/ideas", async (req: Request, res: Response) => {
  const account = await getConnectedAccount(req);
  if (!account) { res.status(401).json({ error: "not_connected" }); return; }

  try {
    const { generateContentIdeas } = await import("../services/claude/contentIdeas");
    const { media } = req.body as { media: unknown[] };
    if (!media?.length) { res.status(400).json({ error: "media array required" }); return; }

    const ideas = await generateContentIdeas({
      username:   account.igUsername,
      followers:  account.igFollowers,
      bio:        account.igBio ?? "",
      media:      media as Parameters<typeof generateContentIdeas>[0]["media"],
    });
    res.json({ ideas });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate ideas";
    res.status(500).json({ error: msg });
  }
});

// ─── DELETE /auth/instagram/disconnect  →  clear session ─────────────────────

router.delete("/instagram/disconnect", async (req: Request, res: Response) => {
  const sessionId = getSessionId(req);
  if (sessionId) {
    await prisma.connectedAccount.deleteMany({ where: { sessionId } });
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ disconnected: true });
});

export default router;
