import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function DELETE() {
  const response = NextResponse.json({ disconnected: true });
  clearSessionCookie(response);
  return response;
}
