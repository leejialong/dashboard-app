import GrokChat from "@/components/grok/GrokChat";

export default function GrokPage() {
  return (
    <div className="app grok-page">
      <header className="page">
        <div className="brand">
          <img src="/dashboard-icon.png" alt="" width={40} height={40} className="brand-icon" />
          <div>
            <h1>Grok</h1>
            <p>No API key. Connect once, then Send reuses that tab with the same prompt.</p>
          </div>
        </div>
        <a className="add-account" href="/">Back to mail</a>
      </header>
      <GrokChat />
    </div>
  );
}
