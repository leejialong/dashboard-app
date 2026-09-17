export type GrokBot = {
  id: string;
  name: string;
  initials: string;
  color: string;
  provider: string;
  preview: string;
  connectUrl: string;
};

export const GROK_BOTS: GrokBot[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    initials: "DS",
    color: "#0ea5e9",
    provider: "DeepSeek",
    preview: "chat.deepseek.com",
    connectUrl: "https://chat.deepseek.com/",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    initials: "CG",
    color: "#10a37f",
    provider: "OpenAI",
    preview: "chatgpt.com",
    connectUrl: "https://chatgpt.com/",
  },
  {
    id: "claude",
    name: "Claude",
    initials: "CL",
    color: "#d4a373",
    provider: "Anthropic",
    preview: "claude.ai",
    connectUrl: "https://claude.ai/new",
  },
  {
    id: "gemini",
    name: "Gemini",
    initials: "GE",
    color: "#6366f1",
    provider: "Google",
    preview: "gemini.google.com",
    connectUrl: "https://gemini.google.com/app",
  },
];

export function grokPromptUrl(bot: GrokBot, question: string): string {
  const q = encodeURIComponent(question);
  switch (bot.id) {
    case "chatgpt":
      return `https://chatgpt.com/?q=${q}`;
    case "claude":
      return `https://claude.ai/new?q=${q}`;
    case "gemini":
      return `https://gemini.google.com/app?q=${q}`;
    case "deepseek":
      return `https://chat.deepseek.com/?q=${q}`;
    default:
      return `${bot.connectUrl}?q=${q}`;
  }
}

export function grokWindowName(botId: string): string {
  return `dash_grok_${botId}`;
}

/** Per-bot Browserbase live-view window so Connect on B does not replace A. */
export function bbLiveWindowName(botId: string): string {
  return `dash_bb_${botId}`;
}
