import { NextResponse } from "next/server";
import { bbConfigured, getLiveSession, liveViewUrl } from "@/lib/bb-client";
import { cloudBot, parseCloudBotId } from "@/lib/bb-bots";
import { connectCdp, openBot, pageForBot, probeBot } from "@/lib/bb-deepseek";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!bbConfigured()) {
      return NextResponse.json(
        { ok: false, configured: false, error: "Save the Browserbase key above first, then Connect." },
        { status: 503 }
      );
    }

    let bot = parseCloudBotId("deepseek");
    try {
      const body = (await req.json()) as { bot?: string };
      bot = parseCloudBotId(body.bot);
    } catch {
      /* default deepseek */
    }
    const spec = cloudBot(bot);

    const { bb, session } = await getLiveSession();
    let probe = null;
    let liveUrl: string | null = null;
    try {
      const { browser } = await connectCdp(session.connectUrl);
      try {
        const page = await pageForBot(browser, bot);
        await openBot(page, bot);
        probe = await probeBot(page, bot);
      } finally {
        await browser.close().catch(() => undefined);
      }
      liveUrl = await liveViewUrl(bb, session.id, spec.host);
    } catch (err) {
      liveUrl = await liveViewUrl(bb, session.id, spec.host);
      return NextResponse.json({
        ok: true,
        configured: true,
        sessionId: session.id,
        liveUrl,
        needLogin: true,
        bot,
        error: err instanceof Error ? err.message : "Cloud Chrome started; open live view to continue",
      });
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      sessionId: session.id,
      liveUrl,
      bot,
      needLogin: !probe?.loggedIn,
      blocked: Boolean(probe?.blocked),
      url: probe?.url,
      title: probe?.title,
      excerpt: probe?.excerpt,
      error: probe?.loggedIn ? undefined : `Log in once inside Cloud Chrome to ${spec.name}.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Cloud Chrome connect failed" },
      { status: 502 }
    );
  }
}
