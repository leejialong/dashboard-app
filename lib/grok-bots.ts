export type GrokBot = {
  id: string;
  name: string;
  initials: string;
  color: string;
  provider: string;
  preview: string;
};

export const GROK_BOTS: GrokBot[] = [
  { id: "customer_service", name: "Customer Service", initials: "CS", color: "#059669", provider: "DeepSeek", preview: "Polite help desk" },
  { id: "project_manager", name: "Project Manager", initials: "PM", color: "#d97706", provider: "DeepSeek", preview: "Plans & next steps" },
  { id: "deepseek", name: "DeepSeek", initials: "DS", color: "#0ea5e9", provider: "DeepSeek", preview: "Technical first" },
  { id: "chatgpt", name: "ChatGPT", initials: "CG", color: "#10a37f", provider: "OpenAI", preview: "General chat" },
  { id: "claude", name: "Claude", initials: "CL", color: "#d4a373", provider: "Anthropic", preview: "Careful analysis" },
  { id: "gemini", name: "Gemini", initials: "GE", color: "#6366f1", provider: "Vertex", preview: "Broad lookup" },
];

export function grokConceptReply(botId: string, question: string): string {
  const q = question.trim() || "(empty)";
  switch (botId) {
    case "customer_service":
      return `Hi - I can help. You asked: "${q}". This Dashboard page is a concept port of Local Grok (sidebar bot + chat). Live Chrome ask stays on your PC at 127.0.0.1:8765.`;
    case "project_manager":
      return `Plan: 1) Keep mail inbox on /  2) Keep this Grok-style chat on /grok  3) Demo replies here; optional live proxy only on your laptop. Question was: "${q}".`;
    case "deepseek":
      return `Concept check: Local Grok = bots registry + POST /api/ask + per-bot history. This site copies that shape, not the CDP/ask_daemon stack. Q: ${q}`;
    case "chatgpt":
      return `Got it. "${q}" - I am the ChatGPT slot in the sidebar. On Vercel I only run the concept reply; I cannot see your local Chrome.`;
    case "claude":
      return `Understood. The idea is a bot list on the left and one thread on the right, same as Local Grok chat.html. You said: "${q}".`;
    case "gemini":
      return `Sidebar bot “Gemini” received: ${q}. Full multi-AI broadcast is not wired on this site — only the layout and one-bot send.`;
    default:
      return `Bot ${botId} (concept): ${q}`;
  }
}
