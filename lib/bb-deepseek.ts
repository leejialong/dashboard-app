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
  await dismissNoise(page);
  if (!page.url().includes("chat.deepseek.com")) {
    await page.goto(DS_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await dismissNoise(page);
  }
  await page.waitForTimeout(800);
}

async function dismissNoise(page: Page): Promise<void> {
  const labels = [/accept all cookies/i, /accept all/i, /got it/i];
  for (const name of labels) {
    const btn = page.getByRole("button", { name });
    if ((await btn.count().catch(() => 0)) > 0) {
      await btn.first().click({ timeout: 1500 }).catch(() => undefined);
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
  await dismissNoise(page);
  const url = page.url();
  const title = await page.title().catch(() => "");
  const body = await page.locator("body").innerText().catch(() => "");
  const lower = `${url} ${title} ${body}`.toLowerCase();
  const blocked = BLOCK_HINTS.some((h) => lower.includes(h));
  const composer = await hasChatComposer(page);
  const passwordVisible =
    (await page.locator('input[type="password"]').count()) > 0 &&
    (await page.locator('input[type="password"]').first().isVisible().catch(() => false));
  return {
    url,
    title,
    loggedIn: !blocked && composer && !passwordVisible,
    blocked,
    excerpt: excerptFrom(body),
  };
}

async function fillComposer(page: Page, question: string): Promise<boolean> {
  const boxes = page.locator("textarea");
  const n = await boxes.count();
  if (n === 0) {
    const editable = page.locator('[contenteditable="true"]');
    if ((await editable.count()) === 0) return false;
    await editable.last().click();
    await editable.last().fill(question);
    return true;
  }
  const box = boxes.last();
  await box.waitFor({ state: "visible", timeout: 15000 });
  await box.click();
  await box.fill(question);
  return true;
}

async function clickSend(page: Page): Promise<void> {
  const labeled = page.getByRole("button", { name: /send|submit/i });
  if ((await labeled.count()) > 0) {
    await labeled.last().click({ timeout: 3000 }).catch(() => undefined);
    return;
  }
  await page.keyboard.press("Enter");
}

async function extractDeepSeek(page: Page, prompt: string): Promise<string> {
  return page.evaluate((question) => {
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
      clone.querySelectorAll("a, button, [class*='cite'], [class*='ref'], sup, nav, aside").forEach((node) => node.remove());
      return (clone.innerText || "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    };
    const nodes = [...document.querySelectorAll(".ds-markdown, [class*='ds-markdown']")].filter((el) => !isSidebarish(el));
    const blocks = nodes.map(clean).filter((t) => !bad(t) && t.length >= 1);
    return blocks.length ? blocks[blocks.length - 1] : "";
  }, prompt);
}

export async function sendAndRead(page: Page, question: string): Promise<{ answer: string; waitedMs: number }> {
  const before = await extractDeepSeek(page, question);
  const filled = await fillComposer(page, question);
  if (!filled) {
    throw new Error("DeepSeek composer not found (login or blocked page)");
  }
  await clickSend(page);

  const started = Date.now();
  let answer = "";
  let stable = 0;
  while (Date.now() - started < 45000) {
    await page.waitForTimeout(1500);
    const now = await extractDeepSeek(page, question);
    if (now && now !== before && now !== question) {
      if (now === answer) {
        stable += 1;
        if (stable >= 2) break;
      } else {
        answer = now;
        stable = 0;
      }
    }
  }

  if (!answer) {
    const body = excerptFrom(await page.locator("body").innerText().catch(() => ""));
    throw new Error(`No DeepSeek reply within 45s. Page: ${body}`);
  }
  return { answer, waitedMs: Date.now() - started };
}
