import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchGmailInbox, refreshAccessToken } from "@/lib/google-auth";
import { decryptSession, encryptSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { Account, Email } from "@/lib/types";
import { REAL_GMAIL_ACCOUNT_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

type MessagesResponse =
  | { connected: false; error?: string }
  | { connected: true; account: Account; emails: Email[] }
  | { connected: true; account: null; emails: []; error: string };

export async function GET() {
  const store = cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return NextResponse.json<MessagesResponse>({ connected: false });
  }

  let session = decryptSession(raw);
  if (!session) {
    const res = NextResponse.json<MessagesResponse>({ connected: false, error: "invalid_session" });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  // Refresh a bit before actual expiry to avoid a request landing right on
  // the boundary.
  let refreshedCookie: string | null = null;
  if (Date.now() > session.expiresAt - 30_000) {
    if (!session.refreshToken) {
      const res = NextResponse.json<MessagesResponse>({ connected: false, error: "expired" });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
    try {
      const tokens = await refreshAccessToken(session.refreshToken);
      session = {
        ...session,
        accessToken: tokens.access_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      };
      refreshedCookie = encryptSession(session);
    } catch (err) {
      console.error("Gmail access token refresh failed:", err);
      const res = NextResponse.json<MessagesResponse>({ connected: false, error: "refresh_failed" });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
  }

  try {
    const { unreadCount, messages } = await fetchGmailInbox(session.accessToken);

    const account: Account = {
      id: REAL_GMAIL_ACCOUNT_ID,
      email: session.email,
      provider: "gmail",
      color: "#34D399",
      unreadCount,
      connected: true,
      status: "connected",
    };
    const emails: Email[] = messages.map((m, i) => ({
      id: REAL_GMAIL_ACCOUNT_ID * 1000 + i + 1,
      accountId: REAL_GMAIL_ACCOUNT_ID,
      sender: m.sender,
      subject: m.subject,
      body: m.snippet, // metadata-format fetch — see README's Phase 3 notes
      receivedAt: m.receivedAt,
      unread: m.unread,
    }));

    const res = NextResponse.json<MessagesResponse>({ connected: true, account, emails });
    if (refreshedCookie) {
      res.cookies.set(SESSION_COOKIE_NAME, refreshedCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return res;
  } catch (err) {
    console.error("Gmail inbox fetch failed:", err);
    return NextResponse.json<MessagesResponse>({
      connected: true,
      account: null,
      emails: [],
      error: "gmail_fetch_failed",
    });
  }
}
