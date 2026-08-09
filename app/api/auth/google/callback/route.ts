import { NextRequest, NextResponse } from "next/server";
import { decodeIdTokenEmail, exchangeCodeForTokens } from "@/lib/google-auth";
import { encryptSession, SESSION_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

function redirectWithError(req: NextRequest, code: string) {
  const url = new URL("/", req.url);
  url.searchParams.set("gmail_error", code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const expectedState = req.cookies.get("google_oauth_state")?.value;

  if (error) {
    // e.g. the user clicked "Cancel" on Google's consent screen.
    return redirectWithError(req, error);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(req, "invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = tokens.id_token ? decodeIdTokenEmail(tokens.id_token) : null;

    if (!email) {
      return redirectWithError(req, "missing_email");
    }
    if (!tokens.refresh_token) {
      // Google only returns a refresh_token on the FIRST consent for a given
      // client+account, unless prompt=consent forces it every time (which we
      // do set in buildGoogleAuthUrl) — but if the user has an old grant
      // lying around this can still occasionally come back empty. Sending
      // them through /api/auth/google again with prompt=consent fixes it.
      return redirectWithError(req, "missing_refresh_token");
    }

    const session = {
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    const res = NextResponse.redirect(new URL("/?connected=1", req.url));
    res.cookies.set(SESSION_COOKIE_NAME, encryptSession(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days; access token itself is refreshed well before this
    });
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    return redirectWithError(req, "token_exchange_failed");
  }
}
