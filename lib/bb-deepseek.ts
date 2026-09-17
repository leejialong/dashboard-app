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
  if (!page.url().includes("chat.deepseek.com")) {
    await page.goto(DS_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  await page.waitForTimeout(1500);
}

export async function probeDeepSeek(page: Page): Promise<DsProbe> {
  const url = page.url();
  const title = await page.title().catch(() => "");
  const body = await page.locator("body").innerText().catch(() => "");
  const lower = `${url} ${title} ${body}`.toLowerCase();
  const blocked = BLOCK_HINTS.some((h) => lower.includes(h)) || url.includes("403");
  const loginPage = /sign_in|login|signin/.test(url) || /log in|sign in/.test(lower);
  const hasComposer = (await page.locator("textarea").count().catch(() => 0)) > 0;
  return {
    url,
    title,
    loggedIn: !blocked && !loginPage && hasComposer,
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

async function collectAssistantTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selectors = [
      ".ds-markdown",
      "[class*='ds-markdown']",
      "[class*='markdown']",
      "[class*='assistant']",
      "[data-role='assistant']",
    ];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((node) => {
        const text = (node as HTMLElement).innerText.replace(/\s+/g, " ").trim();
        if (text.length > 8 && !seen.has(text)) {
          seen.add(text);
          out.push(text);
        }
      });
    }
    return out;
  });
}

export async function sendAndRead(page: Page, question: string): Promise<{ answer: string; waitedMs: number }> {
  const before = await collectAssistantTexts(page);
  const filled = await fillComposer(page, question);
  if (!filled) {
    throw new Error("DeepSeek composer not found (login or blocked page)");
  }
  await clickSend(page);

  const started = Date.now();
  let answer = "";
  while (Date.now() - started < 40000) {
    await page.waitForTimeout(1500);
    const now = await collectAssistantTexts(page);
    const fresh = now.filter((t) => !before.includes(t) && !t.includes(question));
    if (fresh.length) {
      answer = fresh[fresh.length - 1];
      await page.waitForTimeout(2000);
      const later = (await collectAssistantTexts(page)).filter((t) => !before.includes(t) && !t.includes(question));
      if (later.length) answer = later[later.length - 1];
      break;
    }
  }

  if (!answer) {
    const body = excerptFrom(await page.locator("body").innerText().catch(() => ""));
    throw new Error(`No DeepSeek reply within 40s. Page: ${body}`);
  }
  return { answer, waitedMs: Date.now() - started };
}
