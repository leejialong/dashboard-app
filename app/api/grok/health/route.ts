import { NextResponse } from "next/server";

const LOCAL_GROK = process.env.LOCAL_GROK_URL || "http://127.0.0.1:8765";

export async function GET() {
  try {
    const res = await fetch(`${LOCAL_GROK}/health`, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    return NextResponse.json({
      ok: true,
      mode: "local-proxy-available",
      local_grok: data,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      mode: "concept",
      local_grok: null,
      note: "Local Grok is not reachable from this server (normal on Vercel).",
    });
  }
}
