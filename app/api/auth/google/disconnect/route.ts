import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeToken } from "@/lib/google-auth";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;

  if (raw) {
    const session = decryptSession(raw);
    if (session?.refreshToken) {
      // Best-effort: also revoke at Google so the grant disappears from
      // https://myaccount.google.com/permissions instead of just going stale.
      await revokeToken(session.refreshToken);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
