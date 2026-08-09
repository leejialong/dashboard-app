import { Account, Email } from "./types";

// This is the ONLY file that should need to change when mock data
// is replaced by a real database/API layer. Components never import
// mock arrays directly — they receive Account[] / Email[] as props.

export const mockAccounts: Account[] = [
  { id: 1, email: "user1@gmail.com", provider: "gmail", color: "#7EA9FF", unreadCount: 12, connected: true, status: "connected" },
  { id: 2, email: "user2@gmail.com", provider: "gmail", color: "#7EA9FF", unreadCount: 4, connected: true, status: "connected" },
  { id: 3, email: "user3@outlook.com", provider: "outlook", color: "#B084F0", unreadCount: 8, connected: true, status: "connected" },
  { id: 4, email: "user4@gmail.com", provider: "gmail", color: "#7EA9FF", unreadCount: 21, connected: true, status: "connected" },
  { id: 5, email: "user5@gmail.com", provider: "gmail", color: "#7EA9FF", unreadCount: 0, connected: true, status: "connected" },
  { id: 6, email: "user6@gmail.com", provider: "gmail", color: "#7EA9FF", unreadCount: 3, connected: true, status: "connected" },
  { id: 7, email: "team.updates@gmail.com", provider: "gmail", color: "#F2A65A", unreadCount: 17, connected: true, status: "connected" },
  { id: 8, email: "work@outlook.com", provider: "outlook", color: "#B084F0", unreadCount: 0, connected: true, status: "connected" },
  { id: 9, email: "personal@gmail.com", provider: "gmail", color: "#7EA9FF", unreadCount: 6, connected: true, status: "connected" },
  { id: 10, email: "backup.acct@gmail.com", provider: "gmail", color: "#7EA9FF", unreadCount: 0, connected: true, status: "connected" },
  { id: 11, email: "alerts@gmail.com", provider: "gmail", color: "#F2A65A", unreadCount: 31, connected: true, status: "connected" },
  { id: 12, email: "clientwork@outlook.com", provider: "outlook", color: "#B084F0", unreadCount: 2, connected: true, status: "connected" },
];

export const mockEmails: Email[] = [
  { id: 1, accountId: 1, sender: "Shopify", subject: "Your order has shipped", receivedAt: "10:32", unread: true, body: "Your package is on its way and should arrive within 3-5 business days. Track it from your account dashboard." },
  { id: 2, accountId: 2, sender: "GitHub", subject: "Security alert on your account", receivedAt: "10:21", unread: true, body: "We noticed a new sign-in to your account from an unrecognized device. If this was you, no action is needed." },
  { id: 3, accountId: 3, sender: "Priya M.", subject: "Meeting moved to 3pm", receivedAt: "10:05", unread: false, body: "Hey, quick heads up — pushing our sync to 3pm today, same link. Let me know if that clashes with anything." },
  { id: 4, accountId: 1, sender: "Google", subject: "Verification email received", receivedAt: "09:58", unread: true, body: "A verification email was sent to this address. Open the message in your inbox to view the code." },
  { id: 5, accountId: 2, sender: "Notion", subject: "Weekly digest is ready", receivedAt: "09:40", unread: false, body: "Here is what changed across your workspace this week — 14 pages edited, 3 new comments." },
  { id: 6, accountId: 3, sender: "Microsoft", subject: "New sign-in detected", receivedAt: "09:12", unread: true, body: "Your Microsoft account was just signed in from a new location. Review this activity if it wasn't you." },
  { id: 7, accountId: 4, sender: "LinkedIn", subject: "You have 3 new connection requests", receivedAt: "08:55", unread: true, body: "People are looking to connect with you. Review requests and grow your network." },
  { id: 8, accountId: 7, sender: "Slack", subject: "Daily summary — 17 unread messages", receivedAt: "08:40", unread: true, body: "Catch up on conversations across #general, #eng, and 4 other channels." },
  { id: 9, accountId: 9, sender: "Amazon", subject: "Delivered: your recent order", receivedAt: "08:15", unread: false, body: "Your package was delivered today. Let us know if anything is missing or damaged." },
  { id: 10, accountId: 11, sender: "Datadog", subject: "31 alerts triggered overnight", receivedAt: "07:50", unread: true, body: "Multiple monitors crossed their alert thresholds. Review the incident timeline for details." },
];

export function providerLabel(p: Account["provider"]): string {
  return p === "gmail" ? "Gmail" : "Outlook";
}

export function providerLoginUrl(p: Account["provider"]): string {
  return p === "gmail" ? "https://mail.google.com" : "https://outlook.com";
}
