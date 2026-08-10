import { Account, Email } from "@/lib/types";

interface EmailDetailModalProps {
  email: Email;
  account: Account | undefined;
  onClose: () => void;
}

export default function EmailDetailModal({ email, account, onClose }: EmailDetailModalProps) {
  // Deep-link into Gmail's web UI for this message. Use authuser=<email>
  // (not /u/0/) so multi-account browsers open the connected inbox, not
  // whichever Google account happens to occupy slot 0. Only set when we
  // have both a real Gmail message id and the connected account email —
  // this app never sees a password.
  const gmailUrl =
    email.gmailMessageId && account?.email
      ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}#inbox/${email.gmailMessageId}`
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
