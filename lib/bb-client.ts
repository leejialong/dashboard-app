import { cookies } from "next/headers";
import Browserbase from "@browserbasehq/sdk";
import { urlMatchesBotHost } from "@/lib/bb-bots";

export const BB_CTX_COOKIE = "bb_ds_ctx";
export const BB_SID_COOKIE = "bb_ds_sid";
export const BB_KEY_COOKIE = "bb_api_key";
export const BB_PROJ_COOKIE = "bb_project_id";

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function bbApiKey(): string {
  return process.env.BROWSERBASE_API_KEY || cookies().get(BB_KEY_COOKIE)?.value || "";
}

export function bbProjectId(): string {
  return process.env.BROWSERBASE_PROJECT_ID || cookies().get(BB_PROJ_COOKIE)?.value || "";
}

export function bbConfigured(): boolean {
  return Boolean(bbApiKey());
}

export function getBrowserbase(): Browserbase {
  const apiKey = bbApiKey();
  if (!apiKey) {
    throw new Error("BROWSERBASE_API_KEY is not set");
  }
  return new Browserbase({ apiKey });
}

export function readContextId(): string | undefined {
  return cookies().get(BB_CTX_COOKIE)?.value || undefined;
}

export function readSessionId(): string | undefined {
  return cookies().get(BB_SID_COOKIE)?.value || undefined;
}

export function writeContextId(id: string) {
  cookies().set({
    ...COOKIE_BASE,
    name: BB_CTX_COOKIE,
    value: id,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function writeSessionId(id: string) {
  cookies().set({
    ...COOKIE_BASE,
    name: BB_SID_COOKIE,
    value: id,
    maxAge: 60 * 60 * 6,
  });
}

export function clearSessionId() {
  cookies().set({
    ...COOKIE_BASE,
    name: BB_SID_COOKIE,
    value: "",
    maxAge: 0,
  });
}

export function writeBrowserbaseCreds(apiKey: string, projectId: string) {
  cookies().set({
    ...COOKIE_BASE,
    name: BB_KEY_COOKIE,
    value: apiKey,
    maxAge: 60 * 60 * 24 * 30,
  });
  cookies().set({
    ...COOKIE_BASE,
    name: BB_PROJ_COOKIE,
    value: projectId,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearBrowserbaseCreds() {
  cookies().set({ ...COOKIE_BASE, name: BB_KEY_COOKIE, value: "", maxAge: 0 });
  cookies().set({ ...COOKIE_BASE, name: BB_PROJ_COOKIE, value: "", maxAge: 0 });
}

const CONTEXT_NAME = "dash-grok-deepseek";

export async function ensureContextId(bb: Browserbase): Promise<string> {
  const existing = readContextId();
  if (existing) {
    try {
      await bb.contexts.retrieve(existing);
      return existing;
    } catch {
      /* recreate */
    }
  }

  const projectId = bbProjectId();
  try {
    const created = await bb.contexts.create({
      ...(projectId ? { projectId } : {}),
      name: CONTEXT_NAME,
    });
    writeContextId(created.id);
    return created.id;
  } catch {
    const created = await bb.contexts.create(projectId ? { projectId } : {});
    writeContextId(created.id);
    return created.id;
  }
}

export function sessionCreateParams(contextId: string, keepAlive: boolean) {
  const projectId = bbProjectId();
  return {
    ...(projectId ? { projectId } : {}),
    keepAlive,
    timeout: keepAlive ? 21600 : 180,
    userMetadata: { app: "dash-grok", bot: "deepseek" },
    browserSettings: {
      solveCaptchas: true,
      recordSession: false,
      logSession: false,
      verified: true,
      os: "windows" as const,
      context: { id: contextId, persist: true },
    },
  };
}

export async function createSession(bb: Browserbase, contextId: string, keepAlive: boolean) {
  try {
    return await bb.sessions.create(sessionCreateParams(contextId, keepAlive));
  } catch {
    const fallback = sessionCreateParams(contextId, keepAlive);
    const settings = { ...fallback.browserSettings };
    delete (settings as { verified?: boolean }).verified;
    delete (settings as { os?: string }).os;
    return await bb.sessions.create({ ...fallback, browserSettings: settings });
  }
}

export async function liveViewUrl(bb: Browserbase, sessionId: string, host?: string): Promise<string | null> {
  const pick = async () => {
    try {
      const debug = (await bb.sessions.debug(sessionId)) as {
        debuggerFullscreenUrl?: string;
        debuggerUrl?: string;
        pages?: Array<{ url?: string; debuggerFullscreenUrl?: string; debuggerUrl?: string }>;
      };
      if (host && Array.isArray(debug.pages)) {
        const match = [...debug.pages].reverse().find((p) => urlMatchesBotHost(String(p.url || ""), host));
        const pageUrl = match?.debuggerFullscreenUrl || match?.debuggerUrl;
        if (pageUrl) return { url: pageUrl, matched: true };
      }
      return {
        url: debug.debuggerFullscreenUrl || debug.debuggerUrl || null,
        matched: false,
      };
    } catch {
      return { url: `https://www.browserbase.com/sessions/${sessionId}`, matched: false };
    }
  };

  let result = await pick();
  if (host && !result.matched) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    result = await pick();
  }
  return result.url;
}

export async function getLiveSession() {
  const bb = getBrowserbase();
  const contextId = await ensureContextId(bb);
  let session = await reuseRunningSession(bb, readSessionId());
  if (!session) {
    const created = await createSession(bb, contextId, true);
    session = { id: created.id, connectUrl: created.connectUrl };
  }
  writeSessionId(session.id);
  return { bb, session };
}

export async function reuseRunningSession(bb: Browserbase, sessionId: string | undefined) {
  const fromCookie = await sessionIfRunning(bb, sessionId);
  if (fromCookie) return fromCookie;

  try {
    const listed = await bb.sessions.list({ status: "RUNNING" });
    const rows = Array.isArray(listed)
      ? listed
      : Array.isArray((listed as { data?: unknown }).data)
        ? ((listed as { data: { id: string }[] }).data)
        : [];
    for (const row of rows) {
      const meta = (row as { userMetadata?: { app?: string } }).userMetadata;
      const found = await sessionIfRunning(bb, row.id);
      if (found && (!meta || meta.app === "dash-grok")) return found;
    }
  } catch {
    /* list not available */
  }
  return null;
}

async function sessionIfRunning(bb: Browserbase, sessionId: string | undefined) {
  if (!sessionId) return null;
  try {
    const session = await bb.sessions.retrieve(sessionId);
    const status = String((session as { status?: string }).status || "").toUpperCase();
    const connectUrl =
      (session as { connectUrl?: string }).connectUrl ||
      (await bb.sessions.debug(session.id).then((d) => d.wsUrl).catch(() => ""));
    if (status === "RUNNING" && connectUrl) {
      return { id: session.id, connectUrl };
    }
  } catch {
    /* expired */
  }
  return null;
}
