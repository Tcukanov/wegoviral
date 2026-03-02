import { NextResponse } from "next/server";
import { buildOAuthUrl } from "@/lib/graphApi";

export async function GET() {
  if (!process.env.FB_APP_ID) {
    return NextResponse.json({ error: "FB_APP_ID not configured" }, { status: 500 });
  }
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || "https://wegoviral.vercel.app";
  const redirectUri = `${appUrl}/api/auth/instagram/callback`;
  return NextResponse.redirect(buildOAuthUrl(redirectUri));
}
