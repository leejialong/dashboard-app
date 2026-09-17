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
  await box.waitFor({ state: "visible", timeout: 8000 });
  await box.click();
  if (question) await box.fill(question);
  return true;
}

async function clickSend(page: Page): Promise<void> {
  const labeled = page.getByRole("button", { name: /send|submit/i });
  if ((await labeled.count()) > 0) {
    await labeled.last().click({ timeout: 2000 }).catch(() => undefined);
    return;
  }
  await page.keyboard.press("Enter");
}

export async function attachFiles(page: Page, files: UploadFile[]): Promise<void> {
  if (!files.length) return;
  const payload = files.map((f) => ({ name: f.name, mimeType: f.mime || "application/octet-stream", buffer: f.buffer }));
  const hidden = page.locator('input[type="file"]');
  if ((await hidden.count()) > 0) {
    await hidden.first().setInputFiles(payload);
    await page.waitForTimeout(400);
    return;
  }
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 4000 });
  const attachBtn = page.locator("button").filter({ has: page.locator("svg") }).last();
  await page.getByRole("button", { name: /upload|attach|file|image|paperclip/i }).first().click({ timeout: 2000 }).catch(async () => {
    await attachBtn.click({ timeout: 2000 }).catch(() => undefined);
  });
  try {
    const chooser = await chooserPromise;
    await chooser.setFiles(payload);
  } catch {
    throw new Error("Could not attach files in Cloud Chrome");
  }
  await page.waitForTimeout(400);
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
        "button, [class*='cite'], [class*='fingerprint'], sup, nav, aside, [class*='toolbar'], [class*='code-header'], [class*='md-code-block'] > div:first-child"
      ).forEach((node) => node.remove());
      const codes = [...clone.querySelectorAll("pre")].map((pre) => (pre.innerText || "").trim()).filter(Boolean);
      clone.querySelectorAll("pre").forEach((pre) => pre.remove());
      const around = (clone.innerText || "")
        .replace(/html\s*Copy\s*Download\s*Run/gi, "")
        .replace(/\bCopy\s*Download\s*Run\b/gi, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return [around, ...codes].filter(Boolean).join("\n\n");
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
  const stop = page.getByRole("button", { name: /stop|pause/i });
  if ((await stop.count()) > 0 && (await stop.first().isVisible().catch(() => false))) return true;
  return false;
}

export async function sendAndRead(
  page: Page,
  question: string,
  files: UploadFile[] = [],
  onDelta?: (answer: string) => void
): Promise<{ answer: string; media: DsMedia[]; waitedMs: number; truncated: boolean }> {
  const before = await collectBlocks(page, question);
  await attachFiles(page, files);
  const filled = await fillComposer(page, question);
  if (!filled && !files.length) {
    throw new Error("DeepSeek composer not found (login or blocked page)");
  }
  await clickSend(page);

  const started = Date.now();
  let answer = "";
  let stable = 0;
  let truncated = false;
  while (Date.now() - started < 52000) {
    await page.waitForTimeout(700);
    const now = diffBlocks(before, await collectBlocks(page, question));
    if (now) {
      if (now === answer) {
        stable += 1;
        if (stable >= 2 && !(await stillStreaming(page))) break;
      } else {
        answer = now;
        stable = 0;
        onDelta?.(answer);
      }
    }
  }
  if (Date.now() - started >= 52000) truncated = true;
  if (!answer) {
    const body = excerptFrom(await page.locator("body").innerText().catch(() => ""));
    throw new Error(`No DeepSeek reply within 52s. Page: ${body}`);
  }
  if (truncated) answer = `${answer}\n\n[Reply still running in Cloud Chrome — Send again or wait, Vercel stopped at 52s.]`;
  const media = await collectMedia(page);
  return { answer, media, waitedMs: Date.now() - started, truncated };
}
