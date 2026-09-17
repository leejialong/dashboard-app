"use client";

import { useEffect, useMemo, useState } from "react";
import { GROK_BOTS, grokPromptUrl, grokWindowName, type GrokBot } from "@/lib/grok-bots";

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
  const [hist, setHist] = useState<Record<string, Msg[]>>({});

  const bot = useMemo(() => GROK_BOTS.find((b) => b.id === botId) || GROK_BOTS[0], [botId]);
  const messages = hist[botId] || [];
  const isOn = !!connected[botId];

  useEffect(() => {
    setConnected(loadConnected());
  }, []);

  function persist(next: Connected) {
    setConnected(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  }

  function connect(target: GrokBot) {
    window.open(target.connectUrl, grokWindowName(target.id));
    persist({ ...connected, [target.id]: true });
  }

  function disconnect(target: GrokBot) {
    persist({ ...connected, [target.id]: false });
  }

  function send() {
    const question = draft.trim();
    if (!question) return;

    if (!connected[bot.id]) {
      setHist((prev) => ({
        ...prev,
        [botId]: [
          ...(prev[botId] || []),
          { role: "user", text: question },
          { role: "bot", text: `${bot.name} is Offline. Click Connect once (opens that site). Then Send. This page cannot type into that tab or read its answer.` },
        ],
      }));
      setDraft("");
      return;
    }

    const popup = window.open(grokPromptUrl(bot, question), grokWindowName(bot.id));
    setHist((prev) => ({
      ...prev,
      [botId]: [
        ...(prev[botId] || []),
        { role: "user", text: question },
        {
          role: "bot",
          text: popup
            ? `Same prompt sent to the existing ${bot.name} tab (not a new tab). This website cannot auto-click Send there or pull the answer back. That needs Local Grok or a browser extension.`
            : "Popup blocked. Allow popups for this site, then Send again.",
        },
      ],
    }));
    setDraft("");
  }

  return (
    <div className="grok-shell">
      <aside className="grok-side">
        <div className="grok-side-head">Bots · {GROK_BOTS.filter((b) => connected[b.id]).length} connected</div>
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
              {isOn
                ? "Online. Send reuses the same tab with your exact prompt. This page cannot read the reply."
                : "Offline. Connect opens that site once so you can log in."}
            </p>
          </div>
          {isOn ? (
            <button type="button" className="add-account" onClick={() => disconnect(bot)}>Disconnect</button>
          ) : (
            <button type="button" className="add-account" onClick={() => connect(bot)}>Connect</button>
          )}
        </header>
        <div className="grok-thread">
          {messages.length === 0 && (
            <div className="empty-state">
              No API key. Connect opens the site. Send puts the same text in that tab. The answer cannot come back here from a website.
            </div>
          )}
          {messages.map((m, i) => (
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
            placeholder={`Same prompt for ${bot.name}…`}
            rows={2}
          />
          <button type="submit" disabled={!draft.trim()}>Send</button>
        </form>
      </section>
    </div>
  );
}
