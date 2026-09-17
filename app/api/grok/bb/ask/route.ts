import { NextResponse } from "next/server";
import { bbConfigured, clearSessionId, getLiveSession, liveViewUrl } from "@/lib/bb-client";
import { cloudBot, parseCloudBotId } from "@/lib/bb-bots";
import { connectCdp, openBot, pageForBot, probeBot, sendAndRead, type UploadFile } from "@/lib/bb-deepseek";

export const runtime = "nodejs";
export const maxDuration = 60;

async function readAskInput(req: Request): Promise<{ question: string; files: UploadFile[]; bot: ReturnType<typeof parseCloudBotId> }> {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const question = String(form.get("question") || "").trim().slice(0, 8000);
    const bot = parseCloudBotId(form.get("bot"));
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
    return { question, files, bot };
  }
  try {
    const body = (await req.json()) as { question?: string; bot?: string };
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 8000) : "";
    return { question: question || "hello", files: [], bot: parseCloudBotId(body.bot) };
  } catch {
    return { question: "hello", files: [], bot: "deepseek" };
  }
}

export async function POST(req: Request) {
  if (!bbConfigured()) {
    return NextResponse.json(
      { ok: false, configured: false, error: "Save the Browserbase key above first. Then Send will return the answer here." },
      { status: 503 }
    );
  }

  const { question, files, bot } = await readAskInput(req);
  const spec = cloudBot(bot);
  if (!question && !files.length) {
    return NextResponse.json({ ok: false, error: "Type a message or attach a file" }, { status: 400 });
  }

  let bb;
  let connectUrl = "";
  let sessionId = "";
  try {
    const live = await getLiveSession();
    bb = live.bb;
    connectUrl = live.session.connectUrl;
    sessionId = live.session.id;
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
        emit({ type: "status", answer: "Connecting Cloud Chrome…" });
        const { browser } = await connectCdp(connectUrl);
        try {
          const page = await pageForBot(browser, bot);
          await openBot(page, bot);
          const probe = await probeBot(page, bot);
          if (probe.blocked || !probe.loggedIn) {
            const liveUrl = await liveViewUrl(bb, sessionId, spec.host);
            emit({
              type: "done",
              ok: false,
              needLogin: !probe.blocked,
              blocked: probe.blocked,
              liveUrl,
              url: probe.url,
              excerpt: probe.excerpt,
              error: probe.blocked
                ? `${spec.name} rejected the Cloud Chrome session`
                : `Log in once inside Cloud Chrome to ${spec.name}. Later Sends reuse that login.`,
            });
            return;
          }

          const stopAt = Date.now() + 48000;
          const result = await sendAndRead(
            page,
            question,
            files,
            (answer) => emit({ type: "delta", ok: true, answer }),
            (text) => emit({ type: "status", answer: text }),
            stopAt,
            bot
          );
          emit({
            type: "done",
            ok: true,
            configured: true,
            answer: result.answer,
            media: result.media,
            waitedMs: result.waitedMs,
            truncated: result.truncated,
            streaming: result.streaming,
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
      "X-Accel-Buffering": "no",
    },
  });
}

export async function DELETE() {
  clearSessionId();
  return NextResponse.json({ ok: true });
}
