import DeepSeekCloudPoc from "@/components/grok/DeepSeekCloudPoc";
import GrokChat from "@/components/grok/GrokChat";

export default function GrokPage() {
  return (
    <div className="app grok-page">
      <header className="page">
        <div className="brand">
          <img src="/dashboard-icon.png" alt="" width={40} height={40} className="brand-icon" />
          <div>
            <h1>Grok</h1>
            <p>DeepSeek Send asks Cloud Chrome and shows the answer here.</p>
          </div>
        </div>
        <div className="header-actions">
          <a className="add-account" href="/">Home</a>
          <a className="add-account" href="/dashboard">Back to mail</a>
        </div>
      </header>
      <DeepSeekCloudPoc />
      <GrokChat />
    </div>
  );
}
