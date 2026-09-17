import { NextResponse } from "next/server";
import { grokConceptReply } from "@/lib/grok-bots";

const LOCAL_GROK = process.env.LOCAL_GROK_URL || "http://127.0.0.1:8765";
const LIVE = process.env.LOCAL_GROK_LIVE === "1";

export async function POST(req: Request) {
  let body: { bot?: string; question?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const bot = String(body.bot || "customer_service");
  const question = String(body.question || "").trim();
  if (!question) {
    return NextResponse.json({ ok: false, error: "question required" }, { status: 400 });
  }

  if (LIVE) {
    try {
      const res = await fetch(`${LOCAL_GROK}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, bot }),
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json();
      return NextResponse.json({ ok: true, source: "local_grok", bot, data });
    } catch (err) {
      return NextResponse.json({
        ok: true,
        source: "concept-fallback",
        bot,
        text: grokConceptReply(bot, question),
        note: err instanceof Error ? err.message : "local grok ask failed",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    source: "concept",
    bot,
    text: grokConceptReply(bot, question),
  });
}
