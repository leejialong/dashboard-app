import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { buildGoogleAuthUrl } from "@/lib/google-auth";

// Kicks off the OAuth dance: "+ Connect account" -> Google account picker
// -> consent screen -> /api/auth/google/callback.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const state = crypto.randomBytes(16).toString("hex");

  let authUrl: string;
  try {
    authUrl = buildGoogleAuthUrl(state);
  } catch (err) {
    // Missing env vars, most likely — surface it instead of a silent 500.
    const message = err instanceof Error ? err.message : "Failed to build Google auth URL";
    return NextResponse.redirect(
      new URL(`/?gmail_error=${encodeURIComponent(message)}`, req.url)
    );
  }

  const res = NextResponse.redirect(authUrl);
  // Short-lived CSRF cookie, checked in the callback.
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
