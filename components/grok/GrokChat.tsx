"use client";

import { useEffect, useMemo, useState } from "react";
import { GROK_BOTS, type GrokBot } from "@/lib/grok-bots";
import { downloadTextFile, formatBotHtml, splitHtmlReply } from "@/lib/grok-format";

type Media = { kind?: string; url: string; name?: string };
type Msg = { role: "user" | "bot"; text: string; media?: Media[] };

/** Per-bot live status — never mark all Online just because BB key is configured. */
type BotLiveStatus = "unknown" | "online" | "needLogin";

const BOTS_OPEN = "dash_grok_bots_open";

type AskPayload = {
  type?: string;
  ok?: boolean;
  answer?: string;
  error?: string;
  liveUrl?: string;
  needLogin?: boolean;
  configured?: boolean;
  media?: Media[];
  truncated?: boolean;
  streaming?: boolean;
};

function statusLabel(status: BotLiveStatus): string {
  if (status === "online") return "Online";
  if (status === "needLogin") return "Need login";
  return "Offline";
}

export default function GrokChat() {
  const [botId, setBotId] = useState(GROK_BOTS[0].id);
  const [draft, setDraft] = useState("");
  const [hist, setHist] = useState<Record<string, Msg[]>>({});
  const [cloudReady, setCloudReady] = useState(false);
  const [botStatus, setBotStatus] = useState<Record<string, BotLiveStatus>>({});
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [botsOpen, setBotsOpen] = useState(true);

  const bot = useMemo(() => GROK_BOTS.find((b) => b.id === botId) || GROK_BOTS[0], [botId]);
  const messages = hist[botId] || [];
  const currentStatus: BotLiveStatus = botStatus[botId] || "unknown";

  useEffect(() => {
    try {
      setBotsOpen(localStorage.getItem(BOTS_OPEN) !== "0");
    } catch {
      /* ignore */
    }
    refreshCloud().catch(() => setCloudReady(false));
    const onReady = () => {
      refreshCloud().catch(() => undefined);
    };
    window.addEventListener("bb-configured", onReady);
    return () => window.removeEventListener("bb-configured", onReady);
  }, []);

  function markBot(id: string, status: BotLiveStatus) {
    setBotStatus((prev) => (prev[id] === status ? prev : { ...prev, [id]: status }));
  }

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

  async function refreshCloud() {
    const res = await fetch("/api/grok/bb/status", { cache: "no-store" });
    const data = (await res.json()) as { configured?: boolean };
    setCloudReady(Boolean(data.configured));
    return Boolean(data.configured);
  }

  async function connect(target: GrokBot) {
    const ready = await refreshCloud();
    if (!ready) {
      setHist((prev) => ({
        ...prev,
        [target.id]: [
          ...(prev[target.id] || []),
          { role: "bot", text: "Save the Browserbase key if asked, then Connect. Send returns the answer here." },
        ],
      }));
      return;
    }
    const res = await fetch("/api/grok/bb/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot: target.id }),
    });
    const raw = await res.text();
    let data: AskPayload = {};
    try {
      data = raw ? (JSON.parse(raw) as AskPayload) : {};
    } catch {
      data = { error: raw || `Server returned HTTP ${res.status} with no JSON` };
    }
    // Always open liveUrl when present so Connect/Chrome can reach the session.
    if (data.liveUrl) window.open(data.liveUrl, "dash_bb_cloud");
    if (data.needLogin) {
      markBot(target.id, "needLogin");
    } else if (!data.error) {
      markBot(target.id, "online");
    }
    setHist((prev) => ({
      ...prev,
      [target.id]: [
        ...(prev[target.id] || []),
        {
          role: "bot",
          text: data.needLogin
            ? `Cloud Chrome is open. Log in to ${target.name} once. Later Sends reuse that login and return the answer here.`
            : data.error || `Already logged in on Cloud Chrome. Send to get the ${target.name} answer here.`,
        },
      ],
    }));
  }

  async function pollCloud(botKey: string, question: string, apply: (text: string, media?: Media[]) => void) {
    for (let i = 0; i < 4; i++) {
      apply(i === 0 ? `${GROK_BOTS.find((b) => b.id === botKey)?.name || "The bot"} is still writing in Cloud Chrome…` : "Still waiting for the rest of the reply…");
      const res = await fetch("/api/grok/bb/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, bot: botKey }),
      });
      const raw = await res.text();
      let data: AskPayload = {};
      try {
        data = raw ? (JSON.parse(raw) as AskPayload) : {};
      } catch {
        continue;
      }
      if (data.needLogin) {
        markBot(botKey, "needLogin");
        apply(data.error || "Log in once inside Cloud Chrome.");
        return;
      }
      if (data.answer) {
        markBot(botKey, "online");
        apply(data.answer, data.media);
      }
      if (data.ok && data.answer && !data.truncated && !data.streaming) {
        markBot(botKey, "online");
        return;
      }
    }
    apply("Cloud Chrome finished, but this page stopped before the full reply. Open Cloud Chrome to read it, then Send a short follow-up.");
  }

  async function askCloud(targetId: string, question: string, attachments: File[]) {
    const userLine = question || attachments.map((f) => f.name).join(", ");
    setHist((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] || []), { role: "user", text: userLine }, { role: "bot", text: "Sending…" }],
    }));
    setDraft("");
    setFiles([]);
    setSending(true);

    const apply = (text: string, media?: Media[]) => {
      setHist((prev) => {
        const list = [...(prev[targetId] || [])];
        list[list.length - 1] = { role: "bot", text, media };
        return { ...prev, [targetId]: list };
      });
    };

    const shouldPoll = (data: AskPayload) =>
      Boolean(data.truncated || data.streaming || (data.ok && !data.answer) || /No DeepSeek reply|52s/.test(data.error || ""));

    try {
      const body = new FormData();
      body.append("question", question);
      body.append("bot", targetId);
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
        if (data.liveUrl && !data.ok) window.open(data.liveUrl, "dash_bb_cloud");
        if (data.needLogin) {
          markBot(targetId, "needLogin");
          apply(data.error || "Log in once inside Cloud Chrome.");
          return;
        }
        if (shouldPoll(data) && !data.needLogin) {
          await pollCloud(targetId, question || userLine, apply);
          return;
        }
        if (data.ok && data.answer) {
          markBot(targetId, "online");
          apply(data.answer);
        } else {
          apply(data.error || "No reply");
        }
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        apply("No stream from Cloud Chrome");
        await pollCloud(targetId, question || userLine, apply);
        return;
      }
      const dec = new TextDecoder();
      let buf = "";
      let last: AskPayload = {};
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
          last = data;
          if (data.answer) apply(data.answer, data.media);
          if (data.type === "done") {
            if (data.liveUrl && !data.ok) window.open(data.liveUrl, "dash_bb_cloud");
            if (data.configured === false) setCloudReady(false);
            if (data.needLogin) {
              markBot(targetId, "needLogin");
              apply(data.error || "Log in once inside Cloud Chrome.");
              return;
            }
            if (shouldPoll(data)) {
              await pollCloud(targetId, question || userLine, apply);
              return;
            }
            if (data.ok && data.answer) {
              markBot(targetId, "online");
              apply(data.answer, data.media);
            } else {
              apply(data.error || "No reply", data.media);
            }
          }
        }
      }
      if (shouldPoll(last) && !last.needLogin) {
        await pollCloud(targetId, question || userLine, apply);
      } else if (last.ok && last.answer && !last.needLogin) {
        markBot(targetId, "online");
      } else if (last.needLogin) {
        markBot(targetId, "needLogin");
      }
    } catch {
      apply("Connection dropped. Checking Cloud Chrome for the reply…");
      await pollCloud(targetId, question || userLine, apply);
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const question = draft.trim();
    if (sending) return;
    if (!question && files.length === 0) return;
    await askCloud(botId, question, files);
  }

  const onlineCount = GROK_BOTS.filter((b) => botStatus[b.id] === "online").length;

  return (
    <div className={`grok-shell${botsOpen ? "" : " bots-min"}`}>
      <aside className="grok-side">
        <div className="grok-side-head">
          <span className="grok-side-label">Bots · {onlineCount} connected</span>
          <button
            type="button"
            className="grok-side-toggle"
            aria-expanded={botsOpen}
            title={botsOpen ? "Minimize bots" : "Show bots"}
            onClick={() => {
              const next = !botsOpen;
              setBotsOpen(next);
              try {
                localStorage.setItem(BOTS_OPEN, next ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          >
            {botsOpen ? "Hide" : "Show"}
          </button>
        </div>
        {GROK_BOTS.map((b) => {
          const st: BotLiveStatus = botStatus[b.id] || "unknown";
          const on = st === "online";
          const label = statusLabel(st);
          return (
            <button
              key={b.id}
              className={`grok-bot ${b.id === botId ? "active" : ""}`}
              onClick={() => setBotId(b.id)}
              type="button"
              title={`${b.name} · ${label}`}
            >
              <span className="grok-ava" style={{ background: b.color }}>{b.initials}</span>
              <span className="grok-bot-meta">
                <strong>{b.name}</strong>
                <em className={on ? "on" : "off"}>{label}</em>
              </span>
            </button>
          );
        })}
      </aside>
      <section
        className={`grok-main ${dragging ? "drop-on" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(filesFromDataTransfer(e.dataTransfer));
        }}
      >
        <header className="grok-top">
          <div className="grok-top-copy">
            <h2>{bot.name}</h2>
            <p title={
              currentStatus === "online"
                ? `Online. Log in once in Cloud Chrome to ${bot.name}. Later Sends reuse that login and show the answer here.`
                : currentStatus === "needLogin"
                  ? `Need login. Open Cloud Chrome and sign in to ${bot.name}.`
                  : cloudReady
                    ? `Offline until ${bot.name} is probed or a Send succeeds. Connect opens Cloud Chrome.`
                    : "Offline. Save the Browserbase key if asked, Connect once to log in, then Send."
            }>
              {currentStatus === "online"
                ? "Online · Cloud Chrome"
                : currentStatus === "needLogin"
                  ? "Need login · Cloud Chrome"
                  : cloudReady
                    ? "Offline · key ready"
                    : "Offline"}
            </p>
          </div>
          {cloudReady ? (
            <button type="button" className="add-account" title="Open Cloud Chrome" onClick={() => connect(bot)}>Chrome</button>
          ) : (
            <button type="button" className="add-account" onClick={() => connect(bot)}>Connect</button>
          )}
        </header>
        <div className="grok-thread">
          {messages.length === 0 && (
            <div className="empty-state">
              Type a question, drop a file, or tap + . Send goes to Cloud Chrome {bot.name}.
            </div>
          )}
          {messages.map((m, i) => {
            const split = m.role === "bot" ? splitHtmlReply(m.text) : { prose: m.text, html: null as string | null };
            const formatted = m.role === "bot" ? formatBotHtml(split.prose) : "";
            const wide = Boolean(split.html || /<table|<h[1-3]/i.test(formatted));
            return (
            <div key={i} className={`grok-bubble ${m.role}${wide ? " wide" : ""}`}>
              {m.role === "bot" && formatted ? (
                <div className="grok-md" dangerouslySetInnerHTML={{ __html: formatted }} />
              ) : (
                split.prose
              )}
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
          {files.length > 0 && (
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
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={(e) => {
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
              placeholder={`Ask ${bot.name} anything`}
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
