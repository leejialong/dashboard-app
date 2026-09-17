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
  excerpt?: string;
};

export default function DeepSeekCloudPoc() {
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState<string[]>([]);

  function push(line: string) {
    setLog((prev) => [...prev.slice(-20), line]);
  }

  async function refresh() {
    const res = await fetch("/api/grok/bb/status", { cache: "no-store" });
    const data = (await res.json()) as Status;
    setStatus(data);
    return data;
  }

  useEffect(() => {
    refresh().catch(() => setStatus({ configured: false, note: "Status check failed" }));
  }, []);

  async function saveKeys() {
    setBusy("save");
    try {
      const res = await fetch("/api/grok/bb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, projectId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        push(data.error || "Could not save Browserbase key");
        return;
      }
      setApiKey("");
      setProjectId("");
      push("Browserbase saved on this site (httpOnly cookie). Not a DeepSeek API key.");
      await refresh();
      window.dispatchEvent(new Event("bb-configured"));
    } catch (err) {
      push(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy("");
    }
  }

  async function connect() {
    setBusy("connect");
    push("Creating Cloud Chrome session…");
    try {
      const res = await fetch("/api/grok/bb/connect", { method: "POST" });
      const data = (await res.json()) as AskResult;
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
      const raw = await res.text();
      const lines = raw.split("\n").map((l) => l.replace(/^data:\s*/, "").trim()).filter((l) => l.startsWith("{"));
      let data: AskResult = {};
      for (const line of lines) {
        try {
          data = JSON.parse(line) as AskResult;
        } catch {
          /* skip */
        }
      }
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
          <strong>DeepSeek Cloud Chrome</strong>
          <p>
            {ready
              ? "Vercel will type in remote Chrome and return the DeepSeek answer to this page."
              : "This is a Browserbase key, not a DeepSeek API key. Get it from browserbase.com or the Vercel Marketplace, then Save."}
          </p>
        </div>
        <em className={ready ? "on" : "off"}>{ready ? "Configured" : "Not configured"}</em>
      </div>
      {!ready && (
        <form
          className="bb-poc-keys"
          onSubmit={(e) => {
            e.preventDefault();
            saveKeys();
          }}
        >
          <input
            type="password"
            autoComplete="off"
            placeholder="BROWSERBASE_API_KEY"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <input
            type="text"
            autoComplete="off"
            placeholder="BROWSERBASE_PROJECT_ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
          <button type="submit" className="add-account" disabled={!apiKey.trim() || !projectId.trim() || Boolean(busy)}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </form>
      )}
      <div className="bb-poc-actions">
        <button type="button" className="add-account" disabled={!ready || Boolean(busy)} onClick={connect}>
          {busy === "connect" ? "Opening…" : "1. Open Cloud Chrome"}
        </button>
        <button type="button" className="add-account" disabled={!ready || Boolean(busy)} onClick={hello}>
          {busy === "hello" ? "Sending…" : "2. Send hello"}
        </button>
      </div>
      {log.length > 0 && <pre className="bb-poc-log">{log.join("\n")}</pre>}
    </section>
  );
}
