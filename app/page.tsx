import Link from "next/link";

export default function Home() {
  return (
    <div className="app home-page">
      <header className="page">
        <div className="brand">
          <img src="/dashboard-icon.png" alt="" width={40} height={40} className="brand-icon" />
          <div>
            <h1>Home</h1>
            <p>Choose Dashboard or Grok.</p>
          </div>
        </div>
      </header>
      <nav className="home-nav" aria-label="Main">
        <Link className="home-card" href="/dashboard">
          <strong>Dashboard</strong>
          <span>Gmail inbox and connected accounts.</span>
        </Link>
        <Link className="home-card" href="/grok">
          <strong>Grok</strong>
          <span>Cloud Chrome chat with DeepSeek.</span>
        </Link>
      </nav>
    </div>
  );
}
