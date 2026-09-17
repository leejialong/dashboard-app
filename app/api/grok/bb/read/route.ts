import { NextResponse } from "next/server";
import { bbConfigured, getLiveSession } from "@/lib/bb-client";
import { connectCdp, openDeepSeek, probeDeepSeek, readLatest } from "@/lib/bb-deepseek";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!bbConfigured()) {
    return NextResponse.json(
      { ok: false, configured: false, error: "Cloud Chrome is not configured" },
      { status: 503 }
    );
  }

  let question = "";
  try {
    const body = (await req.json()) as { question?: string };
    question = typeof body.question === "string" ? body.question.trim().slice(0, 8000) : "";
  } catch {
    question = "";
  }

  try {
    const { session } = await getLiveSession();
    const { browser, page } = await connectCdp(session.connectUrl);
    try {
      await openDeepSeek(page);
      const probe = await probeDeepSeek(page);
      if (probe.blocked || !probe.loggedIn) {
        return NextResponse.json({
          ok: false,
          needLogin: !probe.blocked,
          error: probe.blocked ? "DeepSeek rejected the Cloud Chrome session" : "Log in once inside Cloud Chrome",
        });
      }
      const result = await readLatest(page, question, undefined, Date.now() + 45000);
      return NextResponse.json({
        ok: true,
        answer: result.answer,
        media: result.media,
        truncated: result.truncated,
        streaming: result.streaming,
        waitedMs: result.waitedMs,
      });
    } finally {
      await browser.close().catch(() => undefined);
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not read Cloud Chrome" },
      { status: 502 }
    );
  }
}
