import { NextResponse } from "next/server";

export async function GET() {
  const appId = process.env.FB_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: "FB_APP_ID not configured" }, { status: 500 });
  }

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || "https://wegoviral.vercel.app";
  const redirectUri = `${appUrl}/api/auth/instagram/callback`;

  const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  url.searchParams.set("client_id",     appId);
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("scope",         "instagram_basic,pages_show_list,pages_read_engagement");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state",         "wgv");

  return NextResponse.redirect(url.toString());
}
