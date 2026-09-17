import { chromium, type Browser, type Page } from "playwright-core";
import { cloudBot, type CloudBotId, type CloudBotSpec } from "@/lib/bb-bots";

const BLOCK_HINTS = [
  "abnormal usage environment",
  "abnormal environment",
  "access denied",
  "request blocked",
  "forbidden",
  "cloudfront",
];

export type DsProbe = {
  url: string;
  title: string;
  loggedIn: boolean;
  blocked: boolean;
  excerpt: string;
};

export type UploadFile = { name: string; mime: string; buffer: Buffer };

export type DsMedia = { kind: "image" | "file"; url: string; name?: string };

function excerptFrom(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 400);
}

export async function connectCdp(connectUrl: string): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = context.pages()[0] || (await context.newPage());
  return { browser, page };
}

function isBlankUrl(url: string): boolean {
  return !url || url === "about:blank" || url.startsWith("chrome://") || url.startsWith("chrome-error://");
}

export async function pageForBot(browser: Browser, botId: CloudBotId): Promise<Page> {
  const spec = cloudBot(botId);
  const context = browser.contexts()[0] || (await browser.newContext());
  for (const p of context.pages()) {
    const url = p.url();
    if (url.includes(spec.host)) {
      await p.bringToFront().catch(() => undefined);
      return p;
    }
  }
  const blank = context.pages().find((p) => isBlankUrl(p.url()));
  const page = blank || (await context.newPage());
  await page.goto(spec.url, { waitUntil: "domcontentloaded", timeout: 25000 });
  return page;
}

export async function openBot(page: Page, botId: CloudBotId): Promise<void> {
  const spec = cloudBot(botId);
  if (page.url().includes(spec.host) && (await hasChatComposer(page, spec))) return;
  await dismissNoise(page);
  if (!page.url().includes(spec.host)) {
    await page.goto(spec.url, { waitUntil: "domcontentloaded", timeout: 25000 });
  }
  await dismissNoise(page);
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    if (await hasChatComposer(page, spec)) return;
    await page.waitForTimeout(400);
  }
}

export async function openDeepSeek(page: Page): Promise<void> {
  await openBot(page, "deepseek");
}

async function dismissNoise(page: Page): Promise<void> {
  const labels = [/accept all cookies/i, /accept all/i, /got it/i];
  for (const name of labels) {
    const btn = page.getByRole("button", { name });
    if ((await btn.count().catch(() => 0)) > 0) {
      await btn.first().click({ timeout: 800 }).catch(() => undefined);
    }
  }
}

async function hasChatComposer(page: Page, spec: CloudBotSpec): Promise<boolean> {
  for (const sel of spec.composers) {
    const loc = page.locator(sel).last();
    if ((await loc.count().catch(() => 0)) === 0) continue;
    if (await loc.isVisible().catch(() => false)) return true;
  }
  return false;
}

export async function probeBot(page: Page, botId: CloudBotId): Promise<DsProbe> {
  const spec = cloudBot(botId);
  const composer = await hasChatComposer(page, spec);
  const passwordVisible =
    (await page.locator('input[type="password"]').count()) > 0 &&
    (await page.locator('input[type="password"]').first().isVisible().catch(() => false));
  const url = page.url();
  let excerpt = "";
  let title = "";
  if (!composer) {
    title = await page.title().catch(() => "");
    excerpt = excerptFrom(await page.locator("body").innerText().catch(() => ""));
  }
  const blocked = BLOCK_HINTS.some((h) => `${url} ${title} ${excerpt}`.toLowerCase().includes(h));
  return {
    url,
    title,
    loggedIn: !blocked && composer && !passwordVisible,
    blocked,
    excerpt,
  };
}

export async function probeDeepSeek(page: Page): Promise<DsProbe> {
  return probeBot(page, "deepseek");
}

async function fillComposer(page: Page, question: string, spec: CloudBotSpec): Promise<boolean> {
  for (const sel of spec.composers) {
    const loc = page.locator(sel).last();
    if ((await loc.count().catch(() => 0)) === 0) continue;
    const visible = await loc.isVisible().catch(() => false);
    if (!visible) continue;
    await loc.click({ timeout: 2500 }).catch(() => undefined);
    if (!question) return true;
    try {
      await loc.fill(question);
    } catch {
      await page.keyboard.press("Control+A").catch(() => undefined);
      await page.keyboard.type(question, { delay: 0 });
    }
    return true;
  }
  return false;
}

async function clickSend(page: Page, spec: CloudBotSpec): Promise<void> {
  for (const sel of spec.send) {
    const btn = page.locator(sel).last();
    if ((await btn.count().catch(() => 0)) === 0) continue;
    if (!(await btn.isEnabled().catch(() => false))) continue;
    await btn.click({ timeout: 1200 }).catch(() => undefined);
    return;
  }
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const labeled = page.getByRole("button", { name: /send|submit/i });
  if ((await labeled.count()) > 0) {
    await labeled.last().click({ timeout: 1200 }).catch(() => undefined);
  }
}

export async function attachFiles(page: Page, files: UploadFile[]): Promise<void> {
  if (!files.length) return;
  const payload = files.map((f) => ({ name: f.name, mimeType: f.mime || "application/octet-stream", buffer: f.buffer }));
  const hidden = page.locator('input[type="file"]');
  if ((await hidden.count()) > 0) {
    await hidden.first().setInputFiles(payload);
    await page.waitForTimeout(150);
    return;
  }
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 2500 });
  const attachBtn = page.locator("button").filter({ has: page.locator("svg") }).last();
  await page.getByRole("button", { name: /upload|attach|file|image|paperclip/i }).first().click({ timeout: 1200 }).catch(async () => {
    await attachBtn.click({ timeout: 1200 }).catch(() => undefined);
  });
  try {
    const chooser = await chooserPromise;
    await chooser.setFiles(payload);
  } catch {
    throw new Error("Could not attach files in Cloud Chrome");
  }
  await page.waitForTimeout(150);
}

function collectScript() {
  return ({ question, replies }: { question: string; replies: string }) => {
    const bad = (t: string) => !t || t === question || /^[---]?\s*\d{1,3}$/.test(t.trim());
    const isSidebarish = (el: Element | null) => {
      let n = el as HTMLElement | null;
      while (n && n !== document.documentElement) {
        const tag = (n.tagName || "").toLowerCase();
        const role = n.getAttribute("role") || "";
        const blob = `${n.className || ""} ${n.id || ""}`.toLowerCase();
        if (tag === "nav" || tag === "aside") return true;
        if (role === "navigation" || role === "complementary") return true;
        if (/sidebar|chat-history|history-list|session-list|ds-aside/.test(blob)) return true;
        n = n.parentElement;
      }
      return false;
    };
    const clean = (el: Element) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(
        "button, script, style, [class*='cite'], [class*='fingerprint'], sup, nav, aside, [class*='toolbar'], [class*='code-header']"
      ).forEach((node) => node.remove());
      return (clone.innerHTML || "")
        .replace(/html\s*Copy\s*Download\s*Run/gi, "")
        .replace(/\bCopy\s*Download\s*Run\b/gi, "")
        .trim();
    };
    const nodes = [...document.querySelectorAll(replies)].filter((el) => {
      if (isSidebarish(el)) return false;
      return el.querySelectorAll(replies).length === 0;
    });
    return nodes.map(clean).filter((t) => !bad(t) && t.length >= 1);
  };
}

async function collectBlocks(page: Page, prompt: string, spec: CloudBotSpec): Promise<string[]> {
  return page.evaluate(collectScript(), { question: prompt, replies: spec.replies.join(", ") });
}

function diffBlocks(before: string[], after: string[]): string {
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i += 1;
  return after.slice(i).join("\n\n").trim();
}

async function collectMedia(page: Page): Promise<DsMedia[]> {
  return page.evaluate(() => {
    const isSidebarish = (el: Element | null) => {
      let n = el as HTMLElement | null;
      while (n && n !== document.documentElement) {
        const tag = (n.tagName || "").toLowerCase();
        const blob = `${n.className || ""} ${n.id || ""}`.toLowerCase();
        if (tag === "nav" || tag === "aside") return true;
        if (/sidebar|chat-history|ds-aside/.test(blob)) return true;
        n = n.parentElement;
      }
      return false;
    };
    const out: { kind: "image" | "file"; url: string; name?: string }[] = [];
    document.querySelectorAll(".ds-markdown img, [class*='ds-markdown'] img").forEach((node) => {
      if (isSidebarish(node)) return;
      const img = node as HTMLImageElement;
      if (img.src) out.push({ kind: "image", url: img.src, name: img.alt || "image" });
    });
    document.querySelectorAll(".ds-markdown a[href], [class*='ds-markdown'] a[href]").forEach((node) => {
      if (isSidebarish(node)) return;
      const a = node as HTMLAnchorElement;
      const href = a.href || "";
      if (/\.(pdf)(\?|$)/i.test(href) || a.download) {
        out.push({ kind: "file", url: href, name: (a.textContent || "file").trim() });
      }
    });
    return out;
  });
}

async function stillStreaming(page: Page, spec: CloudBotSpec): Promise<boolean> {
  for (const sel of spec.stop) {
    const btn = page.locator(sel).first();
    if ((await btn.count().catch(() => 0)) > 0 && (await btn.isVisible().catch(() => false))) return true;
  }
  const stop = page.getByRole("button", { name: /stop generating|stop responding|stop|pause/i });
  if ((await stop.count()) > 0 && (await stop.first().isVisible().catch(() => false))) return true;
  return false;
}

async function extractReply(page: Page, question: string, spec: CloudBotSpec): Promise<string> {
  return page.evaluate(({ q, replies }) => {
    const prompt = (q || "").trim();
    const isSidebarish = (el: Element | null) => {
      let n = el as HTMLElement | null;
      while (n && n !== document.documentElement) {
        const tag = (n.tagName || "").toLowerCase();
        const role = n.getAttribute("role") || "";
        const blob = `${n.className || ""} ${n.id || ""}`.toLowerCase();
        if (tag === "nav" || tag === "aside") return true;
        if (role === "navigation" || role === "complementary") return true;
        if (/sidebar|chat-history|history-list|session-list|ds-aside/.test(blob)) return true;
        n = n.parentElement;
      }
      return false;
    };
    const inComposer = (el: Element | null) => Boolean(el?.closest("textarea, form, [contenteditable='true']"));
    const clean = (el: Element) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(
        "button, script, style, [class*='cite'], [class*='fingerprint'], sup, nav, aside, [class*='toolbar'], [class*='code-header']"
      ).forEach((node) => node.remove());
      return (clone.innerHTML || "")
        .replace(/html\s*Copy\s*Download\s*Run/gi, "")
        .replace(/\bCopy\s*Download\s*Run\b/gi, "")
        .trim();
    };
    const markdowns = [...document.querySelectorAll(replies)].filter((el) => {
      if (isSidebarish(el) || inComposer(el)) return false;
      return el.querySelectorAll(replies).length === 0;
    });
    if (prompt) {
      const userNodes = [...document.querySelectorAll("div, p, span")].filter((el) => {
        if (isSidebarish(el) || inComposer(el)) return false;
        const t = (el as HTMLElement).innerText?.trim() || "";
        return t === prompt || (prompt.length >= 4 && (t.endsWith(prompt) || (t.includes(prompt) && t.length <= prompt.length + 120)));
      });
      const userEl = userNodes[userNodes.length - 1];
      if (userEl) {
        const after = markdowns.filter((el) => {
          const pos = userEl.compareDocumentPosition(el);
          return Boolean(pos & Node.DOCUMENT_POSITION_FOLLOWING);
        });
        const text = after.map(clean).filter((t) => t && t !== prompt).join("\n\n").trim();
        if (text) return text;
      }
    }
    return "";
  }, { q: question, replies: spec.replies.join(", ") });
}

export type WaitResult = {
  answer: string;
  media: DsMedia[];
  waitedMs: number;
  truncated: boolean;
  streaming: boolean;
};

async function waitForAnswer(
  page: Page,
  question: string,
  spec: CloudBotSpec,
  stopAt: number,
  before: string[],
  onDelta?: (answer: string) => void
): Promise<WaitResult> {
  const started = Date.now();
  let answer = "";
  let stable = 0;
  while (Date.now() < stopAt) {
    await page.waitForTimeout(400);
    const fromPrompt = await extractReply(page, question, spec);
    const fromDiff = diffBlocks(before, await collectBlocks(page, question, spec));
    const now = fromPrompt || fromDiff;
    if (now) {
      if (now === answer) {
        stable += 1;
        if (stable >= 3 && !(await stillStreaming(page, spec))) break;
      } else {
        answer = now;
        stable = 0;
        onDelta?.(answer);
      }
    }
  }
  const streaming = await stillStreaming(page, spec);
  const truncated = Date.now() >= stopAt && (streaming || !answer);
  const media = answer ? await collectMedia(page) : [];
  return { answer, media, waitedMs: Date.now() - started, truncated, streaming };
}

export async function sendAndRead(
  page: Page,
  question: string,
  files: UploadFile[] = [],
  onDelta?: (answer: string) => void,
  onStatus?: (text: string) => void,
  stopAt = Date.now() + 48000,
  botId: CloudBotId = "deepseek"
): Promise<WaitResult> {
  const spec = cloudBot(botId);
  const before = await collectBlocks(page, question, spec);
  onStatus?.(`Attaching and typing in ${spec.name}…`);
  await attachFiles(page, files);
  const filled = await fillComposer(page, question, spec);
  if (!filled && !files.length) {
    throw new Error(`${spec.name} composer not found (login or blocked page)`);
  }
  await clickSend(page, spec);
  onStatus?.(`Sent. Waiting for ${spec.name}…`);
  return waitForAnswer(page, question, spec, stopAt, before, onDelta);
}

export async function readLatest(
  page: Page,
  question: string,
  onDelta?: (answer: string) => void,
  stopAt = Date.now() + 45000,
  botId: CloudBotId = "deepseek"
): Promise<WaitResult> {
  const spec = cloudBot(botId);
  const before = await collectBlocks(page, question, spec);
  const existing = await extractReply(page, question, spec);
  if (existing && !(await stillStreaming(page, spec))) {
    onDelta?.(existing);
    return {
      answer: existing,
      media: await collectMedia(page),
      waitedMs: 0,
      truncated: false,
      streaming: false,
    };
  }
  return waitForAnswer(page, question, spec, stopAt, before, onDelta);
}
