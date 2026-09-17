import { GROK_ENV_KEYS, GROK_KEY_COOKIES } from "./grok-bots";

export type ChatTurn = { role: "user" | "bot"; text: string };

function cookieVal(header: string | null, name: string): string {
  if (!header) return "";
  const parts = header.split(";");
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}

export function botApiKey(botId: string, cookieHeader: string | null): string {
  const cookieName = GROK_KEY_COOKIES[botId];
  const fromCookie = cookieName ? cookieVal(cookieHeader, cookieName) : "";
  if (fromCookie) return fromCookie;
  const envName = GROK_ENV_KEYS[botId];
  return envName ? (process.env[envName] || "") : "";
}

export function botIsOnline(botId: string, cookieHeader: string | null): boolean {
  return Boolean(botApiKey(botId, cookieHeader));
}

async function openaiStyle(url: string, key: string, model: string, question: string, history: ChatTurn[]) {
  const messages = [
    ...history.slice(-8).map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text,
    })),
    { role: "user", content: question },
  ];
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || `HTTP ${res.status}`);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty reply");
  return String(text);
}

async function claudeChat(key: string, question: string, history: ChatTurn[]) {
  const messages = [
    ...history.slice(-8).map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text,
    })),
    { role: "user", content: question },
  ];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-0",
      max_tokens: 1024,
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("empty reply");
  return String(text);
}

async function geminiChat(key: string, question: string, history: ChatTurn[]) {
  const contents = [
    ...history.slice(-8).map((m) => ({
      role: m.role === "bot" ? "model" : "user",
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty reply");
  return String(text);
}

export async function askBot(botId: string, key: string, question: string, history: ChatTurn[]): Promise<string> {
  if (botId === "deepseek") {
    return openaiStyle("https://api.deepseek.com/chat/completions", key, "deepseek-chat", question, history);
  }
  if (botId === "chatgpt") {
    return openaiStyle("https://api.openai.com/v1/chat/completions", key, "gpt-4o-mini", question, history);
  }
  if (botId === "claude") {
    return claudeChat(key, question, history);
  }
  if (botId === "gemini") {
    return geminiChat(key, question, history);
  }
  throw new Error("unknown bot");
}
