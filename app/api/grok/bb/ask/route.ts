import { NextResponse } from "next/server";
import {
  bbConfigured,
  clearSessionId,
  createSession,
  ensureContextId,
  getBrowserbase,
  liveViewUrl,
  readSessionId,
  reuseRunningSession,
  writeSessionId,
} from "@/lib/bb-client";
import { connectCdp, openDeepSeek, probeDeepSeek, sendAndRead } from "@/lib/bb-deepseek";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!bbConfigured()) {
    return NextResponse.json(
      { ok: false, configured: false, error: "Save the Browserbase key above first. Then Send will return the DeepSeek answer here." },
      { status: 503 }
    );
  }

  let question = "hello";
  try {
    const body = (await req.json()) as { question?: string };
    if (typeof body.question === "string" && body.question.trim()) {
      question = body.question.trim().slice(0, 4000);
    }
  } catch {
    /* default hello */
  }

  const bb = getBrowserbase();
  const contextId = await ensureContextId(bb);
  let session = await reuseRunningSession(bb, readSessionId());
  if (!session) {
    const created = await createSession(bb, contextId, true);
    session = { id: created.id, connectUrl: created.connectUrl };
  }
  writeSessionId(session.id);

  const { browser, page } = await connectCdp(session.connectUrl);
  try {
    await openDeepSeek(page);
    const probe = await probeDeepSeek(page);
    const liveUrl = await liveViewUrl(bb, session.id);

    if (probe.blocked) {
      return NextResponse.json({
        ok: false,
        blocked: true,
        needLogin: false,
        liveUrl,
        url: probe.url,
        title: probe.title,
        excerpt: probe.excerpt,
        error: "DeepSeek rejected the Cloud Chrome session",
      });
    }

    if (!probe.loggedIn) {
      return NextResponse.json({
        ok: false,
        needLogin: true,
        blocked: false,
        liveUrl,
        url: probe.url,
        title: probe.title,
        excerpt: probe.excerpt,
        error: "Log in inside Cloud Chrome, then Send again",
      });
    }

    const result = await sendAndRead(page, question);
    return NextResponse.json({
      ok: true,
      configured: true,
      answer: result.answer,
      waitedMs: result.waitedMs,
      url: page.url(),
    });
  } catch (err) {
    const liveUrl = await liveViewUrl(bb, session.id);
    return NextResponse.json(
      {
        ok: false,
        liveUrl,
        error: err instanceof Error ? err.message : "Cloud Chrome ask failed",
      },
      { status: 502 }
    );
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function DELETE() {
  clearSessionId();
  return NextResponse.json({ ok: true });
}
