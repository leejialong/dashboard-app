// Minimal Google OAuth 2.0 + Gmail API client built on plain `fetch`.
// Deliberately dependency-free (no `googleapis`, no `next-auth`) — the
// Authorization Code flow and the Gmail REST endpoints we need are small
// enough that a couple of helper functions are clearer than a heavy SDK.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// gmail.readonly is enough to list/read the inbox for this phase (no send,
// no modify). openid+email let us learn the signed-in address from the ID
// token without a second round trip to a userinfo endpoint.
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Check .env.local against .env.example.`);
  }
  return value;
}

export function getRedirectUri(): string {
  return requireEnv("GOOGLE_REDIRECT_URI");
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // ask for a refresh_token
    prompt: "consent", // force refresh_token on every connect, not just the first ever
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

async function postToken(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token endpoint returned ${res.status}: ${text}`);
  }
  return res.json();
}

export function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  return postToken(
    new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    })
  );
}

export function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  return postToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    })
  );
}

export async function revokeToken(token: string): Promise<void> {
  // Best-effort — used on disconnect so the account also disappears from
  // https://myaccount.google.com/permissions. Never let this block/throw
  // the disconnect flow if Google's revoke endpoint is flaky.
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }).catch(() => undefined);
}

// The ID token is a JWT returned directly from Google's token endpoint over
// a server-to-server HTTPS call (not passed through the browser/redirect),
// so we don't need to verify its signature to trust its contents here.
export function decodeIdTokenEmail(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const data = JSON.parse(json) as { email?: string };
    return typeof data.email === "string" ? data.email : null;
  } catch {
    return null;
  }
}

async function gmailGet(accessToken: string, path: string) {
  const res = await fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail API ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

export interface GmailMessageSummary {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string; // e.g. "10:32", matches the mock data's display format
  unread: boolean;
}

interface GmailHeader {
  name: string;
  value: string;
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string | undefined {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

// "Jane Doe <jane@example.com>" -> "Jane Doe"; falls back to the raw email
// (or "Unknown sender") when there's no display name.
function parseSenderName(fromHeader: string | undefined): string {
  if (!fromHeader) return "Unknown sender";
  const match = fromHeader.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].trim();
    return name || match[2];
  }
  return fromHeader.trim();
}

function formatReceivedAt(dateHeader: string | undefined, internalDateMs: string | undefined): string {
  const d = dateHeader ? new Date(dateHeader) : internalDateMs ? new Date(Number(internalDateMs)) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Gmail's `snippet` field comes back HTML-entity-encoded (e.g. "don&#39;t"
// instead of "don't"). There's no DOM available server-side, so decode the
// handful of entities that actually show up in snippets by hand rather than
// pulling in a whole HTML-parsing dependency for this.
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // last, so it doesn't re-corrupt an already-decoded "&..." sequence
}

export interface GmailInboxResult {
  unreadCount: number;
  messages: GmailMessageSummary[];
}

export async function fetchGmailInbox(accessToken: string, maxResults = 15): Promise<GmailInboxResult> {
  const [label, list] = await Promise.all([
    gmailGet(accessToken, `/labels/INBOX`),
    gmailGet(accessToken, `/messages?maxResults=${maxResults}&labelIds=INBOX`),
  ]);

  const ids: string[] = (list.messages || []).map((m: { id: string }) => m.id);

  const messages = await Promise.all(
    ids.map(async (id) => {
      const msg = await gmailGet(
        accessToken,
        `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
      );
      const headers: GmailHeader[] | undefined = msg.payload?.headers;
      const summary: GmailMessageSummary = {
        id: msg.id,
        sender: parseSenderName(getHeader(headers, "From")),
        subject: getHeader(headers, "Subject") || "(no subject)",
        snippet: decodeHtmlEntities(msg.snippet || ""),
        receivedAt: formatReceivedAt(getHeader(headers, "Date"), msg.internalDate),
        unread: Array.isArray(msg.labelIds) && msg.labelIds.includes("UNREAD"),
      };
      return summary;
    })
  );

  return {
    unreadCount: typeof label.messagesUnread === "number" ? label.messagesUnread : 0,
    messages,
  };
}
