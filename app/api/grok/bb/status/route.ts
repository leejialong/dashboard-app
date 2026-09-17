import { NextResponse } from "next/server";
import { bbConfigured, readContextId, readSessionId } from "@/lib/bb-client";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: bbConfigured(),
    hasContext: Boolean(readContextId()),
    hasSession: Boolean(readSessionId()),
    note: bbConfigured()
      ? "Browserbase is configured. Connect opens Cloud Chrome; Online is per-bot after a real login probe."
      : "Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID (Vercel Marketplace or env).",
  });
}
