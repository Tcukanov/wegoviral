/**
 * AES-256-GCM encrypted cookie session — no database required.
 * The access token and profile data live entirely in the browser cookie,
 * encrypted with SESSION_SECRET so the client can't tamper with it.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "wgv_session";
const COOKIE_MAX_AGE = 60 * 24 * 60 * 60; // 60 days in seconds

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "change-this-32-char-secret-now!!";
  return Buffer.from(secret.padEnd(32, "0").slice(0, 32));
}

export interface SessionData {
  accessToken: string;
  igAccountId: string;
  igUsername: string;
  igName?: string;
  igFollowers: number;
  igFollowing: number;
  igMediaCount?: number;
  igProfilePic?: string;
  igBio?: string;
  exp: number; // ms timestamp
}

export function encryptSession(data: SessionData): string {
  const iv  = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const payload = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSession(token: string): SessionData | null {
  try {
    const buf       = Buffer.from(token, "base64url");
    const iv        = buf.subarray(0, 12);
    const tag       = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher  = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const data = JSON.parse(decrypted.toString("utf8")) as SessionData;
    if (data.exp < Date.now()) return null; // expired
    return data;
  } catch {
    return null;
  }
}

/** Read + decrypt session from an incoming request's cookies */
export function getSession(req: NextRequest): SessionData | null {
  const value = req.cookies.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return decryptSession(value);
}

/** Attach an encrypted session cookie to a NextResponse */
export function setSessionCookie(res: NextResponse, data: SessionData): void {
  const encrypted = encryptSession({ ...data, exp: Date.now() + COOKIE_MAX_AGE * 1000 });
  res.cookies.set(SESSION_COOKIE, encrypted, {
    httpOnly: true,
    sameSite: "lax",
    maxAge:   COOKIE_MAX_AGE,
    path:     "/",
    secure:   process.env.NODE_ENV === "production",
  });
}

/** Clear the session cookie */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
}
