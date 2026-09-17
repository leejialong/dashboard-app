"use client";

import { useEffect, useState } from "react";
import DeepSeekCloudPoc from "@/components/grok/DeepSeekCloudPoc";
import GrokChat from "@/components/grok/GrokChat";

const HEADER_OPEN = "dash_grok_header_open";

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

  return (
    <div className={`app grok-page${headerOpen ? "" : " header-min"}`}>
      {headerOpen ? (
        <header className="page">
          <div className="brand">
            <img src="/dashboard-icon.png" alt="" width={40} height={40} className="brand-icon" />
            <div>
              <h1>Grok</h1>
              <p>DeepSeek Send asks Cloud Chrome and shows the answer here.</p>
            </div>
          </div>
          <div className="header-actions">
            <button type="button" className="add-account" onClick={toggleHeader}>
              Hide
            </button>
            <a className="add-account" href="/">Home</a>
            <a className="add-account" href="/dashboard">Back to mail</a>
          </div>
        </header>
      ) : (
        <div className="grok-header-min">
          <button type="button" className="add-account" onClick={toggleHeader}>
            Show
          </button>
          <a className="add-account" href="/">Home</a>
          <a className="add-account" href="/dashboard">Back to mail</a>
        </div>
      )}
      <DeepSeekCloudPoc />
      <GrokChat />
    </div>
  );
}
