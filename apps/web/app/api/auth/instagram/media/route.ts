import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getIGMedia, enrichMediaWithInsights } from "@/lib/graphApi";

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit")) || 20, 50);

  try {
    const media    = await getIGMedia(session.igAccountId, session.pageAccessToken, limit);
    const enriched = await enrichMediaWithInsights(media, session.pageAccessToken);
    return NextResponse.json({ media: enriched });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch media";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
