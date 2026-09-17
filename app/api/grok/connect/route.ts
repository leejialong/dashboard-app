import { NextResponse } from "next/server";
import { GROK_KEY_COOKIES } from "@/lib/grok-bots";

export async function POST(req: Request) {
  let body: { bot?: string; apiKey?: string; disconnect?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const bot = String(body.bot || "");
  const cookieName = GROK_KEY_COOKIES[bot];
  if (!cookieName) {
    return NextResponse.json({ ok: false, error: "unknown bot" }, { status: 400 });
  }

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true, bot, online: !body.disconnect });
  if (body.disconnect) {
    res.cookies.set(cookieName, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  }

  const apiKey = String(body.apiKey || "").trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "apiKey required" }, { status: 400 });
  }

  res.cookies.set(cookieName, apiKey, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
