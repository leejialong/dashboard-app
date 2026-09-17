import { NextResponse } from "next/server";
import { GROK_BOTS, grokPromptUrl } from "@/lib/grok-bots";

export async function POST(req: Request) {
  let body: { question?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const question = String(body.question || "").trim();
  if (!question) {
    return NextResponse.json({ ok: false, error: "question required" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    question,
    tabs: GROK_BOTS.map((bot) => ({
      id: bot.id,
      name: bot.name,
      connectUrl: bot.connectUrl,
      promptUrl: grokPromptUrl(bot, question),
    })),
  });
}
