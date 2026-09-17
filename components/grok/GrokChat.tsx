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

type AskPayload = {
  ok?: boolean;
  answer?: string;
  error?: string;
  liveUrl?: string;
  needLogin?: boolean;
  configured?: boolean;
};

export default function GrokChat() {
  const [botId, setBotId] = useState(GROK_BOTS[0].id);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState<Connected>({});
  const [hist, setHist] = useState<Record<string, Msg[]>>({});
  const [cloudReady, setCloudReady] = useState(false);
  const [sending, setSending] = useState(false);

  const bot = useMemo(() => GROK_BOTS.find((b) => b.id === botId) || GROK_BOTS[0], [botId]);
  const messages = hist[botId] || [];
  const isDeepSeek = bot.id === "deepseek";
  const isOn = isDeepSeek ? cloudReady : !!connected[botId];

  useEffect(() => {
    setConnected(loadConnected());
    refreshCloud().catch(() => setCloudReady(false));
    const onReady = () => {
      refreshCloud().catch(() => undefined);
    };
    window.addEventListener("bb-configured", onReady);
    return () => window.removeEventListener("bb-configured", onReady);
  }, []);

  function persist(next: Connected) {
    setConnected(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  }

  async function refreshCloud() {
    const res = await fetch("/api/grok/bb/status", { cache: "no-store" });
    const data = (await res.json()) as { configured?: boolean };
    setCloudReady(Boolean(data.configured));
    return Boolean(data.configured);
  }

  async function connect(target: GrokBot) {
    if (target.id === "deepseek") {
      const ready = await refreshCloud();
      if (!ready) {
        setHist((prev) => ({
          ...prev,
          [target.id]: [
            ...(prev[target.id] || []),
            { role: "bot", text: "Save the Browserbase key in the panel above, then Connect. DeepSeek Send will return the answer here." },
          ],
        }));
        return;
      }
      const res = await fetch("/api/grok/bb/connect", { method: "POST" });
      const data = (await res.json()) as AskPayload;
      if (data.liveUrl) window.open(data.liveUrl, "dash_bb_deepseek");
      setHist((prev) => ({
        ...prev,
        [target.id]: [
          ...(prev[target.id] || []),
          { role: "bot", text: data.error || "Cloud Chrome is open. Log in to DeepSeek there, then Send. The answer comes back here." },
        ],
      }));
      return;
    }
    window.open(target.connectUrl, grokWindowName(target.id));
    persist({ ...connected, [target.id]: true });
  }

  function disconnect(target: GrokBot) {
    if (target.id === "deepseek") {
      fetch("/api/grok/bb/setup", { method: "DELETE" }).catch(() => undefined);
      setCloudReady(false);
      return;
    }
    persist({ ...connected, [target.id]: false });
  }

  async function askDeepSeek(question: string) {
    setHist((prev) => ({
      ...prev,
      deepseek: [...(prev.deepseek || []), { role: "user", text: question }, { role: "bot", text: "Cloud Chrome is asking DeepSeek…" }],
    }));
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/grok/bb/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json()) as AskPayload;
      if (data.liveUrl && !data.ok) window.open(data.liveUrl, "dash_bb_deepseek");
      const reply = data.ok && data.answer
        ? data.answer
        : data.error || "Cloud Chrome did not return a DeepSeek answer.";
      setHist((prev) => {
        const list = [...(prev.deepseek || [])];
        list[list.length - 1] = { role: "bot", text: reply };
        return { ...prev, deepseek: list };
      });
      if (data.configured === false) setCloudReady(false);
    } catch (err) {
      setHist((prev) => {
        const list = [...(prev.deepseek || [])];
        list[list.length - 1] = { role: "bot", text: err instanceof Error ? err.message : "Cloud ask failed" };
        return { ...prev, deepseek: list };
      });
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const question = draft.trim();
    if (!question || sending) return;

    if (isDeepSeek) {
      await askDeepSeek(question);
      return;
    }

    if (!connected[bot.id]) {
      setHist((prev) => ({
        ...prev,
        [botId]: [
          ...(prev[botId] || []),
          { role: "user", text: question },
          { role: "bot", text: `${bot.name} is Offline. Click Connect once, then Send.` },
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
            ? `Same prompt sent to the existing ${bot.name} tab.`
            : "Popup blocked. Allow popups for this site, then Send again.",
        },
      ],
    }));
    setDraft("");
  }

  return (
    <div className="grok-shell">
      <aside className="grok-side">
        <div className="grok-side-head">Bots · {GROK_BOTS.filter((b) => (b.id === "deepseek" ? cloudReady : connected[b.id])).length} connected</div>
        {GROK_BOTS.map((b) => {
          const on = b.id === "deepseek" ? cloudReady : !!connected[b.id];
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
              {isDeepSeek
                ? cloudReady
                  ? "Online. Send types in Cloud Chrome and shows the DeepSeek answer here."
                  : "Offline. Save the Browserbase key above, Connect once to log in, then Send."
                : isOn
                  ? "Online. Send reuses the same tab with your exact prompt."
                  : "Offline. Connect opens that site once so you can log in."}
            </p>
          </div>
          {isDeepSeek ? (
            cloudReady ? (
              <button type="button" className="add-account" onClick={() => connect(bot)}>Open Cloud Chrome</button>
            ) : (
              <button type="button" className="add-account" onClick={() => connect(bot)}>Connect</button>
            )
          ) : isOn ? (
            <button type="button" className="add-account" onClick={() => disconnect(bot)}>Disconnect</button>
          ) : (
            <button type="button" className="add-account" onClick={() => connect(bot)}>Connect</button>
          )}
        </header>
        <div className="grok-thread">
          {messages.length === 0 && (
            <div className="empty-state">
              {isDeepSeek
                ? "Type a prompt and Send. The Vercel server asks DeepSeek in Cloud Chrome and draws the answer in this thread."
                : "Connect opens the site. Send puts the same text in that tab."}
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
            placeholder={isDeepSeek ? "Ask DeepSeek. The answer comes back here…" : `Same prompt for ${bot.name}…`}
            rows={2}
          />
          <button type="submit" disabled={!draft.trim() || sending}>{sending ? "…" : "Send"}</button>
        </form>
      </section>
    </div>
  );
}
