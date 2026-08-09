"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Account, Email, ProviderFilter } from "@/lib/types";
import { REAL_GMAIL_ACCOUNT_ID } from "@/lib/constants";
import AccountPanel from "./AccountPanel";
import StreamPanel from "./StreamPanel";
import EmailDetailModal from "./EmailDetailModal";
import ConnectAccountModal from "./ConnectAccountModal";

interface DashboardProps {
  initialAccounts: Account[];
  initialEmails: Email[];
}

type GmailMessagesResponse =
  | { connected: false; error?: string }
  | { connected: true; account: Account; emails: Email[] }
  | { connected: true; account: null; emails: Email[]; error?: string };

export default function Dashboard({ initialAccounts, initialEmails }: DashboardProps) {
  // Data (will later come from an API/database instead of props)
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [emails, setEmails] = useState<Email[]>(initialEmails);

  // Phase 3: the one real, OAuth-connected Gmail account layers on top of
  // the Phase 2 mock data. "idle" = haven't checked yet, "loading" =
  // checking/fetching, "connected"/"disconnected" = result of that check.
  const [gmailStatus, setGmailStatus] = useState<"idle" | "loading" | "connected" | "disconnected">("idle");
  const [gmailError, setGmailError] = useState<string | null>(null);

  const mergeRealAccount = useCallback((account: Account | null, realEmails: Email[]) => {
    setAccounts((prev) => {
      const withoutReal = prev.filter((a) => a.id !== REAL_GMAIL_ACCOUNT_ID);
      return account ? [account, ...withoutReal] : withoutReal;
    });
    setEmails((prev) => {
      const withoutReal = prev.filter((e) => e.accountId !== REAL_GMAIL_ACCOUNT_ID);
      return account ? [...realEmails, ...withoutReal] : withoutReal;
    });
  }, []);

  const refreshGmail = useCallback(async () => {
    setGmailStatus("loading");
    setGmailError(null);
    try {
      const res = await fetch("/api/gmail/messages", { cache: "no-store" });
      const data: GmailMessagesResponse = await res.json();
      if (!data.connected) {
        setGmailStatus("disconnected");
        if (data.error) setGmailError(data.error);
        mergeRealAccount(null, []);
        return;
      }
      if (!data.account) {
        // Signed in, but the Gmail API call itself failed (expired scope,
        // Gmail API not enabled on the Google Cloud project, etc.)
        setGmailStatus("connected");
        setGmailError(data.error ?? "gmail_fetch_failed");
        return;
      }
      setGmailStatus("connected");
      mergeRealAccount(data.account, data.emails);
    } catch (err) {
      setGmailStatus("disconnected");
      setGmailError(err instanceof Error ? err.message : "network_error");
    }
  }, [mergeRealAccount]);

  // Check once on mount whether a Gmail account is already connected
  // (covers both a fresh redirect back from Google and returning later
  // with a still-valid session cookie).
  useEffect(() => {
    refreshGmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI state
  const [accountSearch, setAccountSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [expandedAccountId, setExpandedAccountId] = useState<number | null>(null);
  const [selectedInboxAccountId, setSelectedInboxAccountId] = useState<number | null>(null);
  const [mailSearch, setMailSearch] = useState("");
  const [openMoreMenuId, setOpenMoreMenuId] = useState<number | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const unreadTotal = useMemo(() => accounts.reduce((sum, a) => sum + a.unreadCount, 0), [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (accountSearch && !a.email.toLowerCase().includes(accountSearch.toLowerCase())) return false;
      if (providerFilter === "gmail" && a.provider !== "gmail") return false;
      if (providerFilter === "outlook" && a.provider !== "outlook") return false;
      if (providerFilter === "unread" && a.unreadCount === 0) return false;
      return true;
    });
  }, [accounts, accountSearch, providerFilter]);

  const filteredEmails = useMemo(() => {
    return emails.filter((e) => {
      if (selectedInboxAccountId && e.accountId !== selectedInboxAccountId) return false;
      if (mailSearch) {
        const acc = accounts.find((a) => a.id === e.accountId);
        const haystack = `${e.sender} ${e.subject} ${acc ? acc.email : ""}`.toLowerCase();
        if (!haystack.includes(mailSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [emails, accounts, selectedInboxAccountId, mailSearch]);

  const selectedInboxAccount = accounts.find((a) => a.id === selectedInboxAccountId);
  const selectedEmail = emails.find((e) => e.id === selectedEmailId);

  function handleToggleExpand(id: number) {
    setExpandedAccountId((cur) => (cur === id ? null : id));
    setOpenMoreMenuId(null);
  }

  function handleToggleInbox(id: number) {
    setSelectedInboxAccountId((cur) => (cur === id ? null : id));
  }

  function handleToggleMoreMenu(id: number) {
    setOpenMoreMenuId((cur) => (cur === id ? null : id));
  }

  function handleMarkAllRead(id: number) {
    setEmails((prev) => prev.map((e) => (e.accountId === id ? { ...e, unread: false } : e)));
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, unreadCount: 0 } : a)));
    setOpenMoreMenuId(null);
  }

  function handleSync(id: number) {
    setOpenMoreMenuId(null);
    if (id === REAL_GMAIL_ACCOUNT_ID) {
      refreshGmail();
      return;
    }
    // Mock accounts: no real network call yet.
  }

  function handleSettings(id: number) {
    // Mock settings action — placeholder for a future settings panel.
    setOpenMoreMenuId(null);
  }

  async function handleDisconnect(id: number) {
    if (id === REAL_GMAIL_ACCOUNT_ID) {
      setGmailStatus("loading");
      try {
        await fetch("/api/auth/google/disconnect", { method: "POST" });
      } catch {
        // Even if the network call fails, still drop it from local state
        // below — worst case the cookie/grant lingers server-side and the
        // next refreshGmail() call will surface it again.
      }
      setGmailStatus("disconnected");
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setEmails((prev) => prev.filter((e) => e.accountId !== id));
    if (expandedAccountId === id) setExpandedAccountId(null);
    if (selectedInboxAccountId === id) setSelectedInboxAccountId(null);
    setOpenMoreMenuId(null);
  }

  function handleOpenEmail(id: number) {
    const email = emails.find((e) => e.id === id);
    if (!email) return;
    if (email.unread) {
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, unread: false } : e)));
      setAccounts((prev) =>
        prev.map((a) => (a.id === email.accountId ? { ...a, unreadCount: Math.max(0, a.unreadCount - 1) } : a))
      );
    }
    setSelectedEmailId(id);
  }

  return (
    <div className="app">
      <header className="page">
        <div>
          <h1>Unified Inbox</h1>
          <p>
            {accounts.length} connected accounts · {unreadTotal} unread
            {gmailStatus === "loading" && " · syncing Gmail…"}
            {gmailError && ` · Gmail: ${gmailError}`}
          </p>
        </div>
        <button className="add-account" onClick={() => setShowConnectModal(true)}>+ Connect account</button>
      </header>

      <div className="panels">
        <AccountPanel
          accounts={filteredAccounts}
          searchValue={accountSearch}
          onSearchChange={setAccountSearch}
          activeFilter={providerFilter}
          onFilterChange={setProviderFilter}
          expandedAccountId={expandedAccountId}
          onToggleExpand={handleToggleExpand}
          selectedInboxAccountId={selectedInboxAccountId}
          onToggleInbox={handleToggleInbox}
          openMoreMenuId={openMoreMenuId}
          onToggleMoreMenu={handleToggleMoreMenu}
          onMarkAllRead={handleMarkAllRead}
          onSync={handleSync}
          onSettings={handleSettings}
          onDisconnect={handleDisconnect}
        />
        <StreamPanel
          emails={filteredEmails}
          accounts={accounts}
          mailSearch={mailSearch}
          onMailSearchChange={setMailSearch}
          selectedInboxAccount={selectedInboxAccount}
          onClearInboxFilter={() => setSelectedInboxAccountId(null)}
          onOpenEmail={handleOpenEmail}
        />
      </div>

      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          account={accounts.find((a) => a.id === selectedEmail.accountId)}
          onClose={() => setSelectedEmailId(null)}
        />
      )}

      {showConnectModal && <ConnectAccountModal onClose={() => setShowConnectModal(false)} />}
    </div>
  );
}
