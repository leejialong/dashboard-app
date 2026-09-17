export type CloudBotId = "deepseek" | "chatgpt" | "claude" | "gemini";

export type CloudBotSpec = {
  id: CloudBotId;
  name: string;
  url: string;
  host: string;
  composers: string[];
  send: string[];
  replies: string[];
  stop: string[];
};

export const CLOUD_BOTS: Record<CloudBotId, CloudBotSpec> = {
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com/",
    host: "chat.deepseek.com",
    composers: ["textarea", '[contenteditable="true"]'],
    send: [],
    replies: [".ds-markdown", "[class*='ds-markdown']"],
    stop: [],
  },
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    host: "chatgpt.com",
    composers: ["#prompt-textarea", '[data-testid="prompt-textarea"]', 'div[contenteditable="true"]#prompt-textarea'],
    send: ['button[data-testid="send-button"]', 'button[aria-label="Send prompt"]', 'button[aria-label="Send"]'],
    replies: ['[data-message-author-role="assistant"] .markdown', '[data-message-author-role="assistant"]'],
    stop: ['button[data-testid="stop-button"]'],
  },
  claude: {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/new",
    host: "claude.ai",
    composers: [
      "div.ProseMirror",
      '[aria-label="Write your prompt to Claude"]',
      '[aria-label="Message Claude"]',
      '[contenteditable="true"]',
    ],
    send: ['button[aria-label="Send message"]', 'button[aria-label="Send"]'],
    replies: ['[data-testid="assistant"]', ".font-claude-message", "[data-is-streaming]"],
    stop: ['button[aria-label="Stop"]', 'button[aria-label="Stop generating"]'],
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    host: "gemini.google.com",
    composers: [
      '.ql-editor[contenteditable="true"]',
      "rich-textarea .ql-editor",
      ".ql-editor",
      'rich-textarea [contenteditable="true"]',
      '[aria-label="Enter a prompt for Gemini"]',
      '[aria-label*="Enter a prompt"]',
      'div[role="textbox"][contenteditable="true"]',
      '[contenteditable="true"]',
    ],
    send: [
      'button.send-button[aria-label="Send message"]',
      'button[aria-label="Send message"]',
      "button.send-button",
      'button[aria-label="Send"]',
    ],
    // Prefer Gemini web components / author attrs over generic .markdown (matches user turns too).
    replies: [
      "model-response .response-content",
      "model-response",
      ".response-content",
      ".model-response-text",
      '[data-message-author="model"]',
      "message-content .markdown",
      "message-content",
      ".markdown.markdown-main-panel",
    ],
    stop: [
      'button[aria-label="Stop responding"]',
      'button[aria-label="Stop generating"]',
      'button.send-button[aria-label="Stop"]',
      'button[aria-label="Stop"]',
    ],
  },
};

export function parseCloudBotId(raw: unknown): CloudBotId {
  const id = String(raw || "").toLowerCase();
  if (id === "chatgpt" || id === "claude" || id === "gemini" || id === "deepseek") return id;
  return "deepseek";
}

export function cloudBot(id: CloudBotId): CloudBotSpec {
  return CLOUD_BOTS[id];
}

export function urlMatchesBotHost(url: string, host: string): boolean {
  const want = String(host || "").toLowerCase();
  if (!want) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === want || hostname.endsWith(`.${want}`);
  } catch {
    return false;
  }
}
