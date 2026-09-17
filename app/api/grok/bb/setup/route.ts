import { NextResponse } from "next/server";
import { bbConfigured, clearBrowserbaseCreds, writeBrowserbaseCreds } from "@/lib/bb-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { apiKey?: string; projectId?: string } = {};
  try {
    body = (await req.json()) as { apiKey?: string; projectId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const apiKey = String(body.apiKey || "").trim();
  const projectId = String(body.projectId || "").trim();
  if (!apiKey || !projectId) {
    return NextResponse.json(
      { ok: false, error: "Browserbase API key and project id are required" },
      { status: 400 }
    );
  }

  writeBrowserbaseCreds(apiKey, projectId);
  return NextResponse.json({ ok: true, configured: true });
}

export async function DELETE() {
  clearBrowserbaseCreds();
  return NextResponse.json({ ok: true, configured: bbConfigured() });
}
