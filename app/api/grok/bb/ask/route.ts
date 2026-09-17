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

function fail(error: unknown, extra: Record<string, unknown> = {}, status = 502) {
  const message = error instanceof Error ? error.message : "Cloud Chrome ask failed";
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function POST(req: Request) {
  try {
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
          error: "Log in once inside Cloud Chrome. Later Sends reuse that login.",
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
    } finally {
      await browser.close().catch(() => undefined);
    }
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE() {
  clearSessionId();
  return NextResponse.json({ ok: true });
}
