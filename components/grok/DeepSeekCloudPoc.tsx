"use client";

import { useEffect, useState } from "react";

type Status = {
  configured?: boolean;
  hasContext?: boolean;
  hasSession?: boolean;
  note?: string;
};

export default function DeepSeekCloudPoc() {
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

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
    setError("");
    try {
      const res = await fetch("/api/grok/bb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, projectId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(data.error || "Could not save Browserbase key");
        return;
      }
      setApiKey("");
      setProjectId("");
      await refresh();
      window.dispatchEvent(new Event("bb-configured"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy("");
    }
  }

  if (status?.configured) return null;

  return (
    <section className="bb-poc">
      <div className="bb-poc-head">
        <div>
          <strong>DeepSeek Cloud Chrome</strong>
          <p>This is a Browserbase key, not a DeepSeek API key. Get it from browserbase.com or the Vercel Marketplace, then Save.</p>
        </div>
        <em className="off">Not configured</em>
      </div>
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
      {error ? <p className="bb-poc-error">{error}</p> : null}
    </section>
  );
}
