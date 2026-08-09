import { Account } from "@/lib/types";

interface AccountRowProps {
  account: Account;
  index: number;
  onClick: () => void;
}

export default function AccountRow({ account, index, onClick }: AccountRowProps) {
  return (
    <div className="account-row" onClick={onClick}>
      <div className="dot" style={{ background: account.color }} />
      <div className="num">{String(index + 1).padStart(2, "0")}</div>
      <div className="email">{account.email}</div>
      <div className={`unread ${account.unreadCount === 0 ? "zero" : ""}`}>{account.unreadCount}</div>
    </div>
  );
}
