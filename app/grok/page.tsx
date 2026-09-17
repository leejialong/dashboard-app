import GrokChat from "@/components/grok/GrokChat";

export default function GrokPage() {
  return (
    <div className="app grok-page">
      <header className="page">
        <div className="brand">
          <img src="/dashboard-icon.png" alt="" width={40} height={40} className="brand-icon" />
          <div>
            <h1>Grok</h1>
            <p>Concept port of Local Grok — sidebar bots + one chat thread</p>
          </div>
        </div>
        <a className="add-account" href="/">Back to mail</a>
      </header>
      <GrokChat />
    </div>
  );
}
