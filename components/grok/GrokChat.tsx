"use client";

import { useEffect, useMemo, useState } from "react";
import { GROK_BOTS, grokPromptUrl, type GrokBot } from "@/lib/grok-bots";

type Msg = { role: "user" | "bot"; text: string };
type Connected = Record<string, boolean>;

const STORE = "dash_grok_connected";

function loadConnected(): Connected {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function GrokChat() {
  const [botId, setBotId] = useState(GROK_BOTS[0].id);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState<Connected>({});
  const [hist, setHist] = useState<Msg[]>([]);

  const bot = useMemo(() => GROK_BOTS.find((b) => b.id === botId) || GROK_BOTS[0], [botId]);
  const onlineCount = GROK_BOTS.filter((b) => connected[b.id]).length;

  useEffect(() => {
    setConnected(loadConnected());
  }, []);

  function persist(next: Connected) {
    setConnected(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  }

  function connect(target: GrokBot) {
    window.open(target.connectUrl, "_blank", "noopener,noreferrer");
    persist({ ...connected, [target.id]: true });
  }

  function disconnect(target: GrokBot) {
    persist({ ...connected, [target.id]: false });
  }

  function send() {
    const question = draft.trim();
    if (!question) return;
    const targets = GROK_BOTS.filter((b) => connected[b.id]);
    if (targets.length === 0) {
      setHist((prev) => [
        ...prev,
        { role: "user", text: question },
        { role: "bot", text: "All bots are Offline. Click Connect to open DeepSeek / ChatGPT / Claude / Gemini in a new tab, then Send again." },
      ]);
      setDraft("");
      return;
    }

    const opened: string[] = [];
    const blocked: string[] = [];
    for (const target of targets) {
      const popup = window.open(grokPromptUrl(target, question), "_blank", "noopener,noreferrer");
      if (popup) opened.push(target.name);
      else blocked.push(target.name);
    }

    setHist((prev) => [
      ...prev,
      { role: "user", text: question },
      {
        role: "bot",
        text: [
          opened.length ? `Opened with your exact prompt: ${opened.join(", ")}.` : "",
          blocked.length ? `Popup blocked for: ${blocked.join(", ")}. Allow popups for this site, then Send again.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      },
    ]);
    setDraft("");
  }

  return (
    <div className="grok-shell">
      <aside className="grok-side">
        <div className="grok-side-head">Bots · {onlineCount} connected</div>
        {GROK_BOTS.map((b) => {
          const on = !!connected[b.id];
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
              {connected[bot.id]
                ? "Online. Send uses the exact same text in a new tab."
                : "Offline. Connect opens this product in a new tab (log in there if asked)."}
            </p>
          </div>
          {connected[bot.id] ? (
            <button type="button" className="add-account" onClick={() => disconnect(bot)}>Disconnect</button>
          ) : (
            <button type="button" className="add-account" onClick={() => connect(bot)}>Connect</button>
          )}
        </header>
        <div className="grok-thread">
          {hist.length === 0 && (
            <div className="empty-state">
              Connect the bots you want, then type once. Send opens each connected site with the same prompt.
            </div>
          )}
          {hist.map((m, i) => (
            <div key={i} className={`grok-bubble ${m.role}`}>{m.text}</div>
          ))}
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
            placeholder="Same prompt goes to every connected bot…"
            rows={2}
          />
          <button type="submit" disabled={!draft.trim()}>Send</button>
        </form>
      </section>
    </div>
  );
}
