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
import { connectCdp, openDeepSeek, probeDeepSeek, sendAndRead, type UploadFile } from "@/lib/bb-deepseek";

export const runtime = "nodejs";
export const maxDuration = 60;

async function readAskInput(req: Request): Promise<{ question: string; files: UploadFile[] }> {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const question = String(form.get("question") || "").trim().slice(0, 8000);
    const files: UploadFile[] = [];
    for (const item of form.getAll("files")) {
      if (typeof item === "object" && item && "arrayBuffer" in item) {
        const f = item as File;
        if (f.size > 3_500_000) continue;
        files.push({
          name: f.name || "file",
          mime: f.type || "application/octet-stream",
          buffer: Buffer.from(await f.arrayBuffer()),
        });
      }
      if (files.length >= 3) break;
    }
    return { question, files };
  }
  try {
    const body = (await req.json()) as { question?: string };
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 8000) : "";
    return { question: question || "hello", files: [] };
  } catch {
    return { question: "hello", files: [] };
  }
}

export async function POST(req: Request) {
  if (!bbConfigured()) {
    return NextResponse.json(
      { ok: false, configured: false, error: "Save the Browserbase key above first. Then Send will return the DeepSeek answer here." },
      { status: 503 }
    );
  }

  const { question, files } = await readAskInput(req);
  if (!question && !files.length) {
    return NextResponse.json({ ok: false, error: "Type a message or attach a file" }, { status: 400 });
  }

  let connectUrl = "";
  let sessionId = "";
  try {
    const bb = getBrowserbase();
    const contextId = await ensureContextId(bb);
    let session = await reuseRunningSession(bb, readSessionId());
    if (!session) {
      const created = await createSession(bb, contextId, true);
      session = { id: created.id, connectUrl: created.connectUrl };
    }
    writeSessionId(session.id);
    connectUrl = session.connectUrl;
    sessionId = session.id;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not start Cloud Chrome" },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        const bb = getBrowserbase();
        const { browser, page } = await connectCdp(connectUrl);
        try {
          await openDeepSeek(page);
          const probe = await probeDeepSeek(page);
          if (probe.blocked || !probe.loggedIn) {
            const liveUrl = await liveViewUrl(bb, sessionId);
            emit({
              type: "done",
              ok: false,
              needLogin: !probe.blocked,
              blocked: probe.blocked,
              liveUrl,
              url: probe.url,
              excerpt: probe.excerpt,
              error: probe.blocked
                ? "DeepSeek rejected the Cloud Chrome session"
                : "Log in once inside Cloud Chrome. Later Sends reuse that login.",
            });
            return;
          }

          const result = await sendAndRead(page, question, files, (answer) => {
            emit({ type: "delta", ok: true, answer });
          });
          emit({
            type: "done",
            ok: true,
            configured: true,
            answer: result.answer,
            media: result.media,
            waitedMs: result.waitedMs,
            truncated: result.truncated,
          });
        } finally {
          await browser.close().catch(() => undefined);
        }
      } catch (err) {
        emit({ type: "done", ok: false, error: err instanceof Error ? err.message : "Cloud Chrome ask failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function DELETE() {
  clearSessionId();
  return NextResponse.json({ ok: true });
}
