interface ConnectAccountModalProps {
  onClose: () => void;
}

export default function ConnectAccountModal({ onClose }: ConnectAccountModalProps) {
  return (
    <div className="overlay">
      <div className="modal small">
        <h3>Connect account</h3>
        <p>OAuth connection will be implemented in the next phase.</p>
        <button className="close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
