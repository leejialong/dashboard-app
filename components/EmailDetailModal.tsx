import { Account, Email } from "@/lib/types";

interface EmailDetailModalProps {
  email: Email;
  account: Account | undefined;
  onClose: () => void;
}

export default function EmailDetailModal({ email, account, onClose }: EmailDetailModalProps) {
  // Deep-links straight to this message in Gmail's own web UI. If the
  // browser is already signed into this Gmail account, it opens directly;
  // otherwise Google's own login page handles auth -- this app never sees
  // a password. Only set for the real, OAuth-connected Gmail account (mock
  // emails have no real Gmail message behind them).
  const gmailUrl = email.gmailMessageId
    ? `https://mail.google.com/mail/u/0/#inbox/${email.gmailMessageId}`
    : null;

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{email.sender}</h3>
        <div className="meta">{account ? account.email : ""} · {email.receivedAt}</div>
        <div className="body">{email.body}</div>
        <div className="modal-actions">
          {gmailUrl && (
            <a className="open-gmail" href={gmailUrl} target="_blank" rel="noopener noreferrer">
              Open in Gmail ↗
            </a>
          )}
          <button className="close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
