import { Account, ProviderFilter } from "@/lib/types";
import AccountToolbar from "./AccountToolbar";
import AccountRow from "./AccountRow";
import ExpandedAccount from "./ExpandedAccount";

interface AccountPanelProps {
  accounts: Account[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeFilter: ProviderFilter;
  onFilterChange: (filter: ProviderFilter) => void;
  expandedAccountId: number | null;
  onToggleExpand: (id: number) => void;
  selectedInboxAccountId: number | null;
  onToggleInbox: (id: number) => void;
  openMoreMenuId: number | null;
  onToggleMoreMenu: (id: number) => void;
  onMarkAllRead: (id: number) => void;
  onSync: (id: number) => void;
  onSettings: (id: number) => void;
  onDisconnect: (id: number) => void;
  onConnectAccount: () => void;
}

export default function AccountPanel({
  accounts,
  searchValue,
  onSearchChange,
  activeFilter,
  onFilterChange,
  expandedAccountId,
  onToggleExpand,
  selectedInboxAccountId,
  onToggleInbox,
  openMoreMenuId,
  onToggleMoreMenu,
  onMarkAllRead,
  onSync,
  onSettings,
  onDisconnect,
  onConnectAccount,
}: AccountPanelProps) {
  return (
    <div className="accounts-panel">
      <AccountToolbar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />
      <div className="accounts-scroll">
        {accounts.length === 0 && <div className="empty-state">No accounts match your search.</div>}
        {accounts.map((account, i) =>
          account.id === expandedAccountId ? (
            <ExpandedAccount
              key={account.id}
              account={account}
              isInboxSelected={selectedInboxAccountId === account.id}
              isMoreMenuOpen={openMoreMenuId === account.id}
              onToggleInbox={() => onToggleInbox(account.id)}
              onToggleMoreMenu={() => onToggleMoreMenu(account.id)}
              onMarkAllRead={() => onMarkAllRead(account.id)}
              onSync={() => onSync(account.id)}
              onSettings={() => onSettings(account.id)}
              onDisconnect={() => onDisconnect(account.id)}
            />
          ) : (
            <AccountRow
              key={account.id}
              account={account}
              index={i}
              onClick={() => onToggleExpand(account.id)}
            />
          )
        )}
      </div>
      <div className="accounts-footer">
        <button className="add-account" onClick={onConnectAccount}>+ Connect account</button>
      </div>
    </div>
  );
}
