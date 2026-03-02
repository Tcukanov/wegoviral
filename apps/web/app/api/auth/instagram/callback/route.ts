import { NextRequest, NextResponse } from "next/server";
import { completeOAuthFlow } from "@/lib/graphApi";
import { setSessionCookie } from "@/lib/session";
import type { SessionData } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/dashboard?error=oauth_cancelled", request.url));
  }

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL || "https://wegoviral.vercel.app";
  const redirectUri  = `${appUrl}/api/auth/instagram/callback`;

  try {
    const result = await completeOAuthFlow(code, redirectUri);

    const sessionData: SessionData = {
      accessToken:  result.accessToken,
      igAccountId:  result.igAccountId,
      igUsername:   result.profile.username,
      igName:       result.profile.name,
      igFollowers:  result.profile.followers_count,
      igFollowing:  result.profile.follows_count,
      igMediaCount: result.profile.media_count,
      igProfilePic: result.profile.profile_picture_url,
      igBio:        result.profile.biography,
      exp:          Date.now() + 60 * 24 * 60 * 60 * 1000,
    };

    const response = NextResponse.redirect(new URL("/dashboard?connected=1", request.url));
    setSessionCookie(response, sessionData);
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? encodeURIComponent(err.message) : "oauth_error";
    return NextResponse.redirect(new URL(`/dashboard?error=${msg}`, request.url));
  }
}
