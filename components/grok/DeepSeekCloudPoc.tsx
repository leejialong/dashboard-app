"use client";

import { useEffect, useState } from "react";

type Status = {
  configured?: boolean;
  hasContext?: boolean;
  hasSession?: boolean;
  note?: string;
};

type AskResult = {
  ok?: boolean;
  answer?: string;
  error?: string;
  needLogin?: boolean;
  blocked?: boolean;
  liveUrl?: string | null;
  url?: string;
  excerpt?: string;
};

export default function DeepSeekCloudPoc() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState<string[]>([]);

  function push(line: string) {
    setLog((prev) => [...prev.slice(-20), line]);
  }

  async function refresh() {
    const res = await fetch("/api/grok/bb/status", { cache: "no-store" });
    const data = (await res.json()) as Status;
    setStatus(data);
  }

  useEffect(() => {
    refresh().catch(() => setStatus({ configured: false, note: "Status check failed" }));
  }, []);

  async function connect() {
    setBusy("connect");
    push("Creating Cloud Chrome session…");
    try {
      const res = await fetch("/api/grok/bb/connect", { method: "POST" });
      const data = (await res.json()) as AskResult & { sessionId?: string };
      if (data.liveUrl) {
        window.open(data.liveUrl, "dash_bb_deepseek");
        push(data.needLogin ? "Opened Cloud Chrome. Log in to DeepSeek there." : "Opened Cloud Chrome. DeepSeek looks logged in.");
      }
      if (data.blocked) push(`Blocked: ${data.excerpt || data.error || "DeepSeek rejected the session"}`);
      if (data.error && !data.liveUrl) push(data.error);
      await refresh();
    } catch (err) {
      push(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy("");
    }
  }

  async function hello() {
    setBusy("hello");
    push('Sending "hello" through Cloud Chrome…');
    try {
      const res = await fetch("/api/grok/bb/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "hello" }),
      });
      const data = (await res.json()) as AskResult;
      if (data.ok && data.answer) {
        push(`Reply: ${data.answer}`);
      } else {
        if (data.liveUrl) window.open(data.liveUrl, "dash_bb_deepseek");
        push(data.error || "No reply");
        if (data.excerpt) push(`Page: ${data.excerpt}`);
      }
      await refresh();
    } catch (err) {
      push(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setBusy("");
    }
  }

  const ready = Boolean(status?.configured);

  return (
    <section className="bb-poc">
      <div className="bb-poc-head">
        <div>
          <strong>DeepSeek Cloud Chrome POC</strong>
          <p>
            {status
              ? status.configured
                ? "Vercel → Browserbase → remote Chrome → chat.deepseek.com. No Local Grok. No API key."
                : "Browserbase keys are not on this server yet. Add BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID, then retry."
              : "Checking Browserbase…"}
          </p>
        </div>
        <em className={ready ? "on" : "off"}>{ready ? "Configured" : "Not configured"}</em>
      </div>
      <div className="bb-poc-actions">
        <button type="button" className="add-account" disabled={!ready || Boolean(busy)} onClick={connect}>
          {busy === "connect" ? "Opening…" : "1. Open Cloud Chrome"}
        </button>
        <button type="button" className="add-account" disabled={!ready || Boolean(busy)} onClick={hello}>
          {busy === "hello" ? "Sending…" : "2. Send hello"}
        </button>
      </div>
      {log.length > 0 && (
        <pre className="bb-poc-log">{log.join("\n")}</pre>
      )}
    </section>
  );
}
