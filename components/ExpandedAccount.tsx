import { Account } from "@/lib/types";
import { providerLabel, providerLoginUrl } from "@/lib/mock-data";
import MoreMenu from "./MoreMenu";

interface ExpandedAccountProps {
  account: Account;
  isInboxSelected: boolean;
  isMoreMenuOpen: boolean;
  onToggleInbox: () => void;
  onToggleMoreMenu: () => void;
  onMarkAllRead: () => void;
  onSync: () => void;
  onSettings: () => void;
  onDisconnect: () => void;
}

export default function ExpandedAccount({
  account,
  isInboxSelected,
  isMoreMenuOpen,
  onToggleInbox,
  onToggleMoreMenu,
  onMarkAllRead,
  onSync,
  onSettings,
  onDisconnect,
}: ExpandedAccountProps) {
  return (
    <div className="account-row expanded">
      <div className="expanded-top">
        <span className="email">{account.email}</span>
        <span className="unread" style={{ color: account.unreadCount ? "var(--signal)" : "var(--muted)" }}>
          {account.unreadCount}
        </span>
      </div>
      <div className="provider">{providerLabel(account.provider)} · OAuth connected</div>
      <div className="expanded-actions">
        <button className={`btn-ghost ${isInboxSelected ? "selected" : ""}`} onClick={onToggleInbox}>
          Inbox
        </button>
        <button
          className="btn-solid"
          onClick={() => window.open(providerLoginUrl(account.provider), "_blank", "noopener,noreferrer")}
        >
          Login ↗
        </button>
        <button className="btn-more" onClick={onToggleMoreMenu}>•••</button>
        {isMoreMenuOpen && (
          <MoreMenu
            onMarkAllRead={onMarkAllRead}
            onSync={onSync}
            onSettings={onSettings}
            onDisconnect={onDisconnect}
          />
        )}
      </div>
    </div>
  );
}
