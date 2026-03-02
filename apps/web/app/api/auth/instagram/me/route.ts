import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getIGProfile } from "@/lib/graphApi";

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    const profile = await getIGProfile(session.accessToken);
    return NextResponse.json({ connected: true, profile });
  } catch {
    return NextResponse.json({
      connected: true,
      profile: {
        id:                  session.igAccountId,
        username:            session.igUsername,
        name:                session.igName ?? session.igUsername,
        biography:           session.igBio ?? "",
        followers_count:     session.igFollowers,
        follows_count:       session.igFollowing,
        media_count:         session.igMediaCount ?? 0,
        profile_picture_url: session.igProfilePic ?? "",
      },
    });
  }
}
