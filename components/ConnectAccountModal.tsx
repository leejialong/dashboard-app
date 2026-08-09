interface ConnectAccountModalProps {
  onClose: () => void;
}

export default function ConnectAccountModal({ onClose }: ConnectAccountModalProps) {
  return (
    <div className="overlay">
      <div className="modal small">
        <h3>Connect account</h3>
        <p>Sign in with Google to connect a Gmail inbox (read-only).</p>
        <a className="btn-solid" style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }} href="/api/auth/google">
          Continue with Google
        </a>
        <p style={{ opacity: 0.6, fontSize: "0.85em", marginTop: "0.75em" }}>
          Outlook OAuth isn&apos;t wired up yet — Gmail only for now.
        </p>
        <button className="close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
