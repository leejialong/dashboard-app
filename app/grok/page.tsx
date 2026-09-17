import DeepSeekCloudPoc from "@/components/grok/DeepSeekCloudPoc";
import GrokChat from "@/components/grok/GrokChat";

export default function GrokPage() {
  return (
    <div className="app grok-page">
      <header className="page grok-head">
        <div className="brand">
          <img src="/dashboard-icon.png" alt="" width={28} height={28} className="brand-icon" />
          <h1>Grok</h1>
          <button
            type="button"
            className="icon-btn help"
            title="Send types your prompt in Cloud Chrome on DeepSeek, ChatGPT, Claude, or Gemini and shows the answer here."
            aria-label="Help"
          >
            ?
          </button>
        </div>
        <div className="header-actions">
          <a className="icon-btn" href="/" title="Home">⌂</a>
        </div>
      </header>
      <DeepSeekCloudPoc />
      <GrokChat />
    </div>
  );
}
