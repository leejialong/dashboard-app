import { Account, Email } from "@/lib/types";
import EmailRow from "./EmailRow";

interface StreamPanelProps {
  emails: Email[];
  accounts: Account[];
  mailSearch: string;
  onMailSearchChange: (value: string) => void;
  selectedInboxAccount: Account | undefined;
  onClearInboxFilter: () => void;
  onOpenEmail: (id: number) => void;
}

export default function StreamPanel({
  emails,
  accounts,
  mailSearch,
  onMailSearchChange,
  selectedInboxAccount,
  onClearInboxFilter,
  onOpenEmail,
}: StreamPanelProps) {
  return (
    <div className="stream-panel">
      <div className="stream-header">
        <h2>{selectedInboxAccount ? `${selectedInboxAccount.email} · INBOX` : "ALL ACCOUNTS · RECENT"}</h2>
        {selectedInboxAccount && (
          <span className="clear-filter" onClick={onClearInboxFilter}>Clear</span>
        )}
        <input
          className="search"
          placeholder="Search all mail…"
          value={mailSearch}
          onChange={(e) => onMailSearchChange(e.target.value)}
        />
      </div>
      <div className="stream-scroll">
        {emails.length === 0 && <div className="empty-state">No mail matches this view.</div>}
        {emails.map((email) => (
          <EmailRow
            key={email.id}
            email={email}
            account={accounts.find((a) => a.id === email.accountId)}
            onOpen={() => onOpenEmail(email.id)}
          />
        ))}
      </div>
    </div>
  );
}
