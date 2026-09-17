import { cookies } from "next/headers";
import Browserbase from "@browserbasehq/sdk";

export const BB_CTX_COOKIE = "bb_ds_ctx";
export const BB_SID_COOKIE = "bb_ds_sid";

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function bbConfigured(): boolean {
  return Boolean(process.env.BROWSERBASE_API_KEY);
}

export function getBrowserbase(): Browserbase {
  const apiKey = process.env.BROWSERBASE_API_KEY;
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
    maxAge: 60 * 10,
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

export async function ensureContextId(bb: Browserbase): Promise<string> {
  const existing = readContextId();
  if (existing) return existing;

  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  const created = await bb.contexts.create(projectId ? { projectId } : {});
  writeContextId(created.id);
  return created.id;
}

export function sessionCreateParams(contextId: string, keepAlive: boolean) {
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  return {
    ...(projectId ? { projectId } : {}),
    keepAlive,
    timeout: keepAlive ? 600 : 180,
    proxies: true,
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

export async function liveViewUrl(bb: Browserbase, sessionId: string): Promise<string | null> {
  try {
    const debug = await bb.sessions.debug(sessionId);
    return debug.debuggerFullscreenUrl || debug.debuggerUrl || null;
  } catch {
    return `https://www.browserbase.com/sessions/${sessionId}`;
  }
}

export async function reuseRunningSession(bb: Browserbase, sessionId: string | undefined) {
  if (!sessionId) return null;
  try {
    const session = await bb.sessions.retrieve(sessionId);
    const status = String((session as { status?: string }).status || "").toUpperCase();
    const connectUrl = (session as { connectUrl?: string }).connectUrl;
    if (status === "RUNNING" && connectUrl) {
      return { id: session.id, connectUrl };
    }
  } catch {
    /* expired */
  }
  return null;
}
