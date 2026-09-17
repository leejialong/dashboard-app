"use client";

import { useEffect, useMemo, useState } from "react";
import { GROK_BOTS, grokPromptUrl, grokWindowName, type GrokBot } from "@/lib/grok-bots";
import { downloadTextFile, splitHtmlReply } from "@/lib/grok-format";

type Media = { kind?: string; url: string; name?: string };
type Msg = { role: "user" | "bot"; text: string; media?: Media[] };
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
  type?: string;
  ok?: boolean;
  answer?: string;
  error?: string;
  liveUrl?: string;
  needLogin?: boolean;
  configured?: boolean;
  media?: Media[];
};

export default function GrokChat() {
  const [botId, setBotId] = useState(GROK_BOTS[0].id);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState<Connected>({});
  const [hist, setHist] = useState<Record<string, Msg[]>>({});
  const [cloudReady, setCloudReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

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

  function addFiles(list: File[]) {
    if (!list.length) return;
    setFiles((prev) => {
      const next = [...prev];
      for (const file of list) {
        if (next.length >= 3) break;
        if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
        next.push(file);
      }
      return next;
    });
  }

  function filesFromDataTransfer(dt: DataTransfer | null): File[] {
    if (!dt) return [];
    return Array.from(dt.files || []).filter(Boolean);
  }

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
      const raw = await res.text();
      let data: AskPayload = {};
      try {
        data = raw ? (JSON.parse(raw) as AskPayload) : {};
      } catch {
        data = { error: raw || `Server returned HTTP ${res.status} with no JSON` };
      }
      if (data.liveUrl && data.needLogin) window.open(data.liveUrl, "dash_bb_deepseek");
      setHist((prev) => ({
        ...prev,
        [target.id]: [
          ...(prev[target.id] || []),
          {
            role: "bot",
            text: data.needLogin
              ? "Cloud Chrome is open. Log in to DeepSeek once. Later Sends reuse that login and return the answer here."
              : data.error || "Already logged in on Cloud Chrome. Send to get the answer here.",
          },
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

  async function askDeepSeek(question: string, attachments: File[]) {
    const userLine = question || attachments.map((f) => f.name).join(", ");
    setHist((prev) => ({
      ...prev,
      deepseek: [...(prev.deepseek || []), { role: "user", text: userLine }, { role: "bot", text: "Sending…" }],
    }));
    setDraft("");
    setFiles([]);
    setSending(true);

    const apply = (text: string, media?: Media[]) => {
      setHist((prev) => {
        const list = [...(prev.deepseek || [])];
        list[list.length - 1] = { role: "bot", text, media };
        return { ...prev, deepseek: list };
      });
    };

    try {
      const body = new FormData();
      body.append("question", question);
      attachments.forEach((f) => body.append("files", f));
      const res = await fetch("/api/grok/bb/ask", { method: "POST", body });
      const ctype = res.headers.get("content-type") || "";
      if (!ctype.includes("text/event-stream")) {
        const raw = await res.text();
        let data: AskPayload = {};
        try {
          data = raw ? (JSON.parse(raw) as AskPayload) : {};
        } catch {
          data = { error: raw || `HTTP ${res.status}` };
        }
        if (data.liveUrl && !data.ok) window.open(data.liveUrl, "dash_bb_deepseek");
        apply(data.ok && data.answer ? data.answer : data.error || "No DeepSeek reply");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        apply("No stream from Cloud Chrome");
        return;
      }
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";
        for (const chunk of chunks) {
          const line = chunk.replace(/^data:\s*/, "").trim();
          if (!line) continue;
          let data: AskPayload = {};
          try {
            data = JSON.parse(line) as AskPayload;
          } catch {
            continue;
          }
          if (data.answer) apply(data.answer, data.media);
          if (data.type === "done") {
            if (data.liveUrl && !data.ok) window.open(data.liveUrl, "dash_bb_deepseek");
            apply(
              data.ok && data.answer ? data.answer : data.error || "No DeepSeek reply",
              data.media
            );
            if (data.configured === false) setCloudReady(false);
          }
        }
      }
    } catch (err) {
      apply(err instanceof Error ? err.message : "Cloud ask failed");
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const question = draft.trim();
    if (sending) return;

    if (isDeepSeek) {
      if (!question && files.length === 0) return;
      await askDeepSeek(question, files);
      return;
    }

    if (!question) return;

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
      <section
        className={`grok-main ${isDeepSeek && dragging ? "drop-on" : ""}`}
        onDragEnter={(e) => {
          if (!isDeepSeek) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (!isDeepSeek) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (!isDeepSeek) return;
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={(e) => {
          if (!isDeepSeek) return;
          e.preventDefault();
          setDragging(false);
          addFiles(filesFromDataTransfer(e.dataTransfer));
        }}
      >
        <header className="grok-top">
          <div>
            <h2>{bot.name}</h2>
            <p>
              {isDeepSeek
                ? cloudReady
                  ? "Online. Log in once in Cloud Chrome. Later Sends reuse that login and show the answer here."
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
                ? "Type a question, drop a file, or tap + . Send goes to DeepSeek."
                : "Connect opens the site. Send puts the same text in that tab."}
            </div>
          )}
          {messages.map((m, i) => {
            const split = m.role === "bot" ? splitHtmlReply(m.text) : { prose: m.text, html: null as string | null };
            return (
            <div key={i} className={`grok-bubble ${m.role}${split.html ? " wide" : ""}`}>
              {split.prose}
              {split.html && (
                <div className="grok-html">
                  <button
                    type="button"
                    className="add-account"
                    onClick={() => downloadTextFile("deepseek.html", split.html || "", "text/html")}
                  >
                    Download HTML
                  </button>
                  <iframe className="grok-html-preview" sandbox="" title="HTML preview" srcDoc={split.html} />
                </div>
              )}
              {m.media && m.media.length > 0 && (
                <div className="grok-media">
                  {m.media.map((item, j) =>
                    item.kind === "image" || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(item.url) ? (
                      <img key={j} src={item.url} alt={item.name || "image"} />
                    ) : (
                      <a key={j} href={item.url} target="_blank" rel="noreferrer">{item.name || item.url}</a>
                    )
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
        <form
          className="grok-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {isDeepSeek && files.length > 0 && (
            <div className="grok-chips">
              {files.map((f) => (
                <span key={f.name + f.size} className="grok-chip">
                  {f.name}
                  <button
                    type="button"
                    className="grok-x"
                    onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="grok-bar">
            {isDeepSeek && (
              <label className="grok-plus" title="Add photos and files">
                +
                <input
                  type="file"
                  accept="image/*,.pdf,.txt,.csv,.doc,.docx"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={(e) => {
                if (!isDeepSeek) return;
                const pasted = Array.from(e.clipboardData?.files || []);
                if (pasted.length) {
                  e.preventDefault();
                  addFiles(pasted);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.altKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={isDeepSeek ? "Ask anything" : `Same prompt for ${bot.name}…`}
              rows={1}
            />
            <button
              type="submit"
              className="grok-send"
              disabled={sending || (!draft.trim() && files.length === 0)}
              aria-label="Send"
            >
              {sending ? "…" : "↑"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
