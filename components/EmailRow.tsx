import { Account, Email } from "@/lib/types";

interface EmailRowProps {
  email: Email;
  account: Account | undefined;
  onOpen: () => void;
}

export default function EmailRow({ email, account, onOpen }: EmailRowProps) {
  return (
    <div className="email-row" onClick={onOpen}>
      <div className="dot" style={{ background: account ? account.color : "#666" }} />
      <div className="row-time">{email.receivedAt}</div>
      <div className="row-account">{account ? `${account.provider}${account.id}` : ""}</div>
      <div className={`row-content ${email.unread ? "unread" : ""}`}>
        <span className="sender">{email.sender}</span>
        <span className="subject">{email.subject}</span>
      </div>
      <div className="row-open">Open ↗</div>
    </div>
  );
}
