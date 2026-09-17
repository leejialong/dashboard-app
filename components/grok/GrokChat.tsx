"use client";

import { useMemo, useState } from "react";
import { GROK_BOTS } from "@/lib/grok-bots";

type Msg = { role: "user" | "bot"; text: string };

export default function GrokChat() {
  const [botId, setBotId] = useState(GROK_BOTS[0].id);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<Record<string, Msg[]>>({});

  const bot = useMemo(() => GROK_BOTS.find((b) => b.id === botId) || GROK_BOTS[0], [botId]);
  const messages = hist[botId] || [];

  async function send() {
    const question = draft.trim();
    if (!question || busy) return;
    setDraft("");
    setHist((prev) => ({ ...prev, [botId]: [...(prev[botId] || []), { role: "user", text: question }] }));
    setBusy(true);
    try {
      const res = await fetch("/api/grok/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot: botId, question }),
      });
      const data = await res.json();
      const text = data.text || data.data?.text || data.note || data.error || "No reply";
      setHist((prev) => ({ ...prev, [botId]: [...(prev[botId] || []), { role: "bot", text: String(text) }] }));
    } catch (err) {
      setHist((prev) => ({
        ...prev,
        [botId]: [...(prev[botId] || []), { role: "bot", text: err instanceof Error ? err.message : "network_error" }],
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grok-shell">
      <aside className="grok-side">
        <div className="grok-side-head">Bots</div>
        {GROK_BOTS.map((b) => (
          <button
            key={b.id}
            className={`grok-bot ${b.id === botId ? "active" : ""}`}
            onClick={() => setBotId(b.id)}
            type="button"
          >
            <span className="grok-ava" style={{ background: b.color }}>{b.initials}</span>
            <span className="grok-bot-meta">
              <strong>{b.name}</strong>
              <em>{b.preview}</em>
            </span>
          </button>
        ))}
      </aside>
      <section className="grok-main">
        <header className="grok-top">
          <div>
            <h2>{bot.name}</h2>
            <p>Runs on this website. No local app to open. Demo bot replies for now.</p>
          </div>
        </header>
        <div className="grok-thread">
          {messages.length === 0 && <div className="empty-state">Pick a bot and send a message. Enter to send.</div>}
          {messages.map((m, i) => (
            <div key={i} className={`grok-bubble ${m.role}`}>{m.text}</div>
          ))}
          {busy && <div className="grok-bubble bot">Thinking…</div>}
        </div>
        <form
          className="grok-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.altKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${bot.name}…`}
            rows={2}
          />
          <button type="submit" disabled={busy || !draft.trim()}>Send</button>
        </form>
      </section>
    </div>
  );
}
