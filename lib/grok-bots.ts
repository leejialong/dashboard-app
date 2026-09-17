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
    preview: "Server API",
    connectUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    initials: "CG",
    color: "#10a37f",
    provider: "OpenAI",
    preview: "Server API",
    connectUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "claude",
    name: "Claude",
    initials: "CL",
    color: "#d4a373",
    provider: "Anthropic",
    preview: "Server API",
    connectUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gemini",
    name: "Gemini",
    initials: "GE",
    color: "#6366f1",
    provider: "Google",
    preview: "Server API",
    connectUrl: "https://aistudio.google.com/apikey",
  },
];

export const GROK_KEY_COOKIES: Record<string, string> = {
  deepseek: "grok_key_deepseek",
  chatgpt: "grok_key_chatgpt",
  claude: "grok_key_claude",
  gemini: "grok_key_gemini",
};

export const GROK_ENV_KEYS: Record<string, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  chatgpt: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};
