export type Provider = "gmail" | "outlook";

export type AccountStatus = "connected" | "syncing" | "disconnected";

export interface Account {
  id: number;
  email: string;
  provider: Provider;
  color: string;
  unreadCount: number;
  connected: boolean;
  status: AccountStatus;
}

export interface Email {
  id: number;
  accountId: number;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string; // display time, e.g. "10:32"
  unread: boolean;
  // Only set for the real, OAuth-connected Gmail account — the Gmail
  // message id used to deep-link "Open in Gmail" (undefined otherwise).
  gmailMessageId?: string;
}

export type ProviderFilter = "all" | "gmail" | "outlook" | "unread";
