import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { generateContentIdeas } from "@/lib/contentIdeas";
import type { IGMedia } from "@/lib/graphApi";

export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    const body  = await request.json() as { media?: IGMedia[] };
    const media = body.media;
    if (!media?.length) return NextResponse.json({ error: "media array required" }, { status: 400 });

    const ideas = await generateContentIdeas(
      session.igUsername,
      session.igFollowers,
      session.igBio ?? "",
      media
    );
    return NextResponse.json({ ideas });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate ideas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
