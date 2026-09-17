"use client";

import { useEffect, useState } from "react";
import DeepSeekCloudPoc from "@/components/grok/DeepSeekCloudPoc";
import GrokChat from "@/components/grok/GrokChat";

const HEADER_OPEN = "dash_grok_header_open";
const HELP =
  "Send types your prompt in Cloud Chrome on DeepSeek, ChatGPT, Claude, or Gemini and shows the answer here.";

export default function GrokPage() {
  const [headerOpen, setHeaderOpen] = useState(true);

  useEffect(() => {
    try {
      setHeaderOpen(localStorage.getItem(HEADER_OPEN) !== "0");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleHeader() {
    const next = !headerOpen;
    setHeaderOpen(next);
    try {
      localStorage.setItem(HEADER_OPEN, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const nav = (
    <div className="header-actions">
      <button type="button" className="icon-btn" title={headerOpen ? "Hide header" : "Show header"} onClick={toggleHeader}>
        {headerOpen ? "–" : "+"}
      </button>
      <a className="icon-btn" href="/" title="Home">⌂</a>
      <a className="icon-btn" href="/dashboard" title="Back to mail">✉</a>
    </div>
  );

  return (
    <div className={`app grok-page${headerOpen ? "" : " header-min"}`}>
      {headerOpen ? (
        <header className="page grok-head">
          <div className="brand">
            <img src="/dashboard-icon.png" alt="" width={28} height={28} className="brand-icon" />
            <h1>Grok</h1>
            <button type="button" className="icon-btn help" title={HELP} aria-label="Help">
              ?
            </button>
          </div>
          {nav}
        </header>
      ) : (
        <div className="grok-header-min">{nav}</div>
      )}
      <DeepSeekCloudPoc />
      <GrokChat />
    </div>
  );
}
