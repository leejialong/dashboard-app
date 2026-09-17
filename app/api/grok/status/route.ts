import { NextResponse } from "next/server";
import { GROK_BOTS } from "@/lib/grok-bots";
import { botIsOnline } from "@/lib/grok-providers";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie");
  return NextResponse.json({
    ok: true,
    bots: Object.fromEntries(GROK_BOTS.map((b) => [b.id, botIsOnline(b.id, cookie)])),
  });
}
