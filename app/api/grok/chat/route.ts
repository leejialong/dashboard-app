import { NextResponse } from "next/server";
import { askBot, botApiKey, type ChatTurn } from "@/lib/grok-providers";

export async function POST(req: Request) {
  let body: { bot?: string; question?: string; history?: ChatTurn[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const bot = String(body.bot || "deepseek");
  const question = String(body.question || "").trim();
  if (!question) {
    return NextResponse.json({ ok: false, error: "question required" }, { status: 400 });
  }

  const key = botApiKey(bot, req.headers.get("cookie"));
  if (!key) {
    return NextResponse.json({
      ok: false,
      offline: true,
      error: "Offline. Connect this bot and save an API key. The reply stays on this page.",
    });
  }

  try {
    const history = Array.isArray(body.history) ? body.history : [];
    const text = await askBot(bot, key, question, history);
    return NextResponse.json({ ok: true, bot, text });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "ask failed",
    });
  }
}
