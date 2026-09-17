import { NextResponse } from "next/server";
import {
  bbConfigured,
  createSession,
  ensureContextId,
  getBrowserbase,
  liveViewUrl,
  readSessionId,
  reuseRunningSession,
  writeSessionId,
} from "@/lib/bb-client";
import { connectCdp, openDeepSeek, probeDeepSeek } from "@/lib/bb-deepseek";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    if (!bbConfigured()) {
      return NextResponse.json(
        { ok: false, configured: false, error: "Save the Browserbase key above first, then Connect." },
        { status: 503 }
      );
    }

    const bb = getBrowserbase();
    const contextId = await ensureContextId(bb);
    const reused = await reuseRunningSession(bb, readSessionId());
    const session = reused ? reused : await createSession(bb, contextId, true);
    writeSessionId(session.id);

    let probe = null;
    let liveUrl = await liveViewUrl(bb, session.id);
    try {
      const { browser, page } = await connectCdp(session.connectUrl);
      try {
        await openDeepSeek(page);
        probe = await probeDeepSeek(page);
      } finally {
        await browser.close().catch(() => undefined);
      }
      liveUrl = (await liveViewUrl(bb, session.id)) || liveUrl;
    } catch (err) {
      return NextResponse.json({
        ok: true,
        configured: true,
        sessionId: session.id,
        liveUrl,
        needLogin: true,
        error: err instanceof Error ? err.message : "Cloud Chrome started; open live view to continue",
      });
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      sessionId: session.id,
      liveUrl,
      needLogin: !probe?.loggedIn,
      blocked: Boolean(probe?.blocked),
      url: probe?.url,
      title: probe?.title,
      excerpt: probe?.excerpt,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Cloud Chrome connect failed" },
      { status: 502 }
    );
  }
}
