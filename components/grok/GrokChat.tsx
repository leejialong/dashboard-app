"use client";

import { useEffect, useMemo, useState } from "react";
import { GROK_BOTS, type GrokBot } from "@/lib/grok-bots";

type Msg = { role: "user" | "bot"; text: string };

export default function GrokChat() {
  const [botId, setBotId] = useState(GROK_BOTS[0].id);
  const [draft, setDraft] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [hist, setHist] = useState<Record<string, Msg[]>>({});

  const bot = useMemo(() => GROK_BOTS.find((b) => b.id === botId) || GROK_BOTS[0], [botId]);
  const messages = hist[botId] || [];
  const isOn = !!online[botId];

  async function refreshStatus() {
    const res = await fetch("/api/grok/status", { cache: "no-store" });
    const data = await res.json();
    setOnline(data.bots || {});
  }

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, []);

  async function connect(target: GrokBot) {
    window.open(target.connectUrl, "_blank", "noopener,noreferrer");
  }

  async function saveKey() {
    const key = apiKey.trim();
    if (!key) return;
    setBusy(true);
    try {
      const res = await fetch("/api/grok/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot: botId, apiKey: key }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "save failed");
      setApiKey("");
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/grok/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot: botId, disconnect: true }),
      });
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const question = draft.trim();
    if (!question || busy) return;
    setDraft("");
    const nextHist = [...messages, { role: "user" as const, text: question }];
    setHist((prev) => ({ ...prev, [botId]: nextHist }));
    setBusy(true);
    try {
      const res = await fetch("/api/grok/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot: botId, question, history: messages }),
      });
      const data = await res.json();
      const text = data.ok ? String(data.text) : String(data.error || "No reply");
      setHist((prev) => ({ ...prev, [botId]: [...(prev[botId] || nextHist), { role: "bot", text }] }));
    } catch (err) {
      setHist((prev) => ({
        ...prev,
        [botId]: [...(prev[botId] || nextHist), { role: "bot", text: err instanceof Error ? err.message : "network_error" }],
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grok-shell">
      <aside className="grok-side">
        <div className="grok-side-head">Bots · {GROK_BOTS.filter((b) => online[b.id]).length} online</div>
        {GROK_BOTS.map((b) => {
          const on = !!online[b.id];
          return (
            <button
              key={b.id}
              className={`grok-bot ${b.id === botId ? "active" : ""}`}
              onClick={() => setBotId(b.id)}
              type="button"
            >
              <span className="grok-ava" style={{ background: b.color }}>{b.initials}</span>
              <span className="grok-bot-meta">
                <strong>{b.name}</strong>
                <em className={on ? "on" : "off"}>{on ? "Online" : "Offline"}</em>
              </span>
            </button>
          );
        })}
      </aside>
      <section className="grok-main">
        <header className="grok-top">
          <div>
            <h2>{bot.name}</h2>
            <p>
              {isOn
                ? "Online. Send stays on this page and shows the reply here."
                : "Offline. Connect opens the key page. Paste the key once, then chat here."}
            </p>
          </div>
          {isOn ? (
            <button type="button" className="add-account" onClick={disconnect}>Disconnect</button>
          ) : (
            <button type="button" className="add-account" onClick={() => connect(bot)}>Connect</button>
          )}
        </header>
        {!isOn && (
          <div className="grok-keybar">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`${bot.name} API key`}
            />
            <button type="button" className="add-account" onClick={saveKey} disabled={busy || !apiKey.trim()}>
              Save key
            </button>
          </div>
        )}
        <div className="grok-thread">
          {messages.length === 0 && (
            <div className="empty-state">
              {isOn ? `Ask ${bot.name}. The answer stays in this chat.` : `Connect ${bot.name} first.`}
            </div>
          )}
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
            placeholder={isOn ? `Message ${bot.name}…` : `${bot.name} is Offline`}
            rows={2}
          />
          <button type="submit" disabled={busy || !draft.trim() || !isOn}>Send</button>
        </form>
      </section>
    </div>
  );
}
