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
}

export type ProviderFilter = "all" | "gmail" | "outlook" | "unread";
