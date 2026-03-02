import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAccountInsights } from "@/lib/graphApi";

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    const insights = await getAccountInsights(session.igAccountId, session.accessToken);
    return NextResponse.json({ insights });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch insights";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
