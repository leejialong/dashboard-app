import { chromium, type Browser, type Page } from "playwright-core";

const DS_URL = "https://chat.deepseek.com/";

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

export async function openDeepSeek(page: Page): Promise<void> {
  if (page.url().includes("chat.deepseek.com") && (await hasChatComposer(page))) {
    return;
  }
  await dismissNoise(page);
  if (!page.url().includes("chat.deepseek.com")) {
    await page.goto(DS_URL, { waitUntil: "domcontentloaded", timeout: 25000 });
  }
  await dismissNoise(page);
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

async function hasChatComposer(page: Page): Promise<boolean> {
  const ta = page.locator("textarea");
  if ((await ta.count().catch(() => 0)) === 0) return false;
  const last = ta.last();
  const visible = await last.isVisible().catch(() => false);
  if (!visible) return false;
  const ph = ((await last.getAttribute("placeholder").catch(() => "")) || "").toLowerCase();
  if (/message|ask|deepseek|prompt/.test(ph)) return true;
  const password = page.locator('input[type="password"]');
  const passwordVisible = (await password.count()) > 0 && (await password.first().isVisible().catch(() => false));
  return !passwordVisible;
}

export async function probeDeepSeek(page: Page): Promise<DsProbe> {
  const composer = await hasChatComposer(page);
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

async function fillComposer(page: Page, question: string): Promise<boolean> {
  const boxes = page.locator("textarea");
  const n = await boxes.count();
  if (n === 0) {
    const editable = page.locator('[contenteditable="true"]');
    if ((await editable.count()) === 0) return false;
    await editable.last().click();
    if (question) await editable.last().fill(question);
    return true;
  }
  const box = boxes.last();
  await box.waitFor({ state: "visible", timeout: 2500 });
  await box.click();
  if (question) await box.fill(question);
  return true;
}

async function clickSend(page: Page): Promise<void> {
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const box = page.locator("textarea").last();
  const leftover = ((await box.inputValue().catch(() => "")) || "").trim();
  if (!leftover) return;
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
  return (question: string) => {
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
    const nodes = [...document.querySelectorAll(".ds-markdown, [class*='ds-markdown']")].filter((el) => {
      if (isSidebarish(el)) return false;
      return el.querySelectorAll(".ds-markdown").length === 0;
    });
    return nodes.map(clean).filter((t) => !bad(t) && t.length >= 1);
  };
}

async function collectBlocks(page: Page, prompt: string): Promise<string[]> {
  return page.evaluate(collectScript(), prompt);
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

async function stillStreaming(page: Page): Promise<boolean> {
  const stop = page.getByRole("button", { name: /stop generating|stop|pause/i });
  if ((await stop.count()) > 0 && (await stop.first().isVisible().catch(() => false))) return true;
  return false;
}

async function extractReply(page: Page, question: string): Promise<string> {
  return page.evaluate((q) => {
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
    const markdowns = [...document.querySelectorAll(".ds-markdown, [class*='ds-markdown']")].filter((el) => {
      if (isSidebarish(el) || inComposer(el)) return false;
      return el.querySelectorAll(".ds-markdown, [class*='ds-markdown']").length === 0;
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
  }, question);
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
  stopAt: number,
  before: string[],
  onDelta?: (answer: string) => void
): Promise<WaitResult> {
  const started = Date.now();
  let answer = "";
  let stable = 0;
  while (Date.now() < stopAt) {
    await page.waitForTimeout(400);
    const fromPrompt = await extractReply(page, question);
    const fromDiff = diffBlocks(before, await collectBlocks(page, question));
    const now = fromPrompt || fromDiff;
    if (now) {
      if (now === answer) {
        stable += 1;
        if (stable >= 3 && !(await stillStreaming(page))) break;
      } else {
        answer = now;
        stable = 0;
        onDelta?.(answer);
      }
    }
  }
  const streaming = await stillStreaming(page);
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
  stopAt = Date.now() + 48000
): Promise<WaitResult> {
  const before = await collectBlocks(page, question);
  onStatus?.("Attaching and typing in DeepSeek…");
  await attachFiles(page, files);
  const filled = await fillComposer(page, question);
  if (!filled && !files.length) {
    throw new Error("DeepSeek composer not found (login or blocked page)");
  }
  await clickSend(page);
  onStatus?.("Sent. Waiting for DeepSeek…");
  return waitForAnswer(page, question, stopAt, before, onDelta);
}

export async function readLatest(
  page: Page,
  question: string,
  onDelta?: (answer: string) => void,
  stopAt = Date.now() + 45000
): Promise<WaitResult> {
  const before = await collectBlocks(page, question);
  const existing = await extractReply(page, question);
  if (existing && !(await stillStreaming(page))) {
    onDelta?.(existing);
    return {
      answer: existing,
      media: await collectMedia(page),
      waitedMs: 0,
      truncated: false,
      streaming: false,
    };
  }
  return waitForAnswer(page, question, stopAt, before, onDelta);
}
