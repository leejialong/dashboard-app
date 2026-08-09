import { Account, Email } from "@/lib/types";

interface EmailDetailModalProps {
  email: Email;
  account: Account | undefined;
  onClose: () => void;
}

export default function EmailDetailModal({ email, account, onClose }: EmailDetailModalProps) {
  return (
    <div className="overlay">
      <div className="modal">
        <h3>{email.sender}</h3>
        <div className="meta">{account ? account.email : ""} · {email.receivedAt}</div>
        <div className="body">{email.body}</div>
        <button className="close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
