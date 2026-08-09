# Unified Inbox — Phase 3 (Google OAuth + Gmail)

Phase 2 converted the working `index.html` prototype into a maintainable
Next.js + TypeScript app running on mock data only. Phase 3 adds a real,
read-only connection to **one** Gmail account via Google OAuth — everything
else (Outlook accounts, the other 11 mock Gmail accounts) is still mock
data, exactly as before.

## Project structure

```
app/
  layout.tsx        root layout, imports globals.css
  page.tsx           entry point, passes mock data into <Dashboard />
  globals.css         all styling, ported from the prototype's <style>

components/
  Dashboard.tsx        owns all state (search, filters, expanded/selected
                        account, modals) — the only "smart" component
  AccountPanel.tsx      left column: toolbar + scrollable account list
  AccountToolbar.tsx    search input + All/Gmail/Outlook/Unread chips
  AccountRow.tsx         one collapsed account row
  ExpandedAccount.tsx    the open state of an account row (Inbox/Login/•••)
  MoreMenu.tsx            dropdown: mark all read / sync / settings / disconnect
  StreamPanel.tsx        right column: unified email list + search
  EmailRow.tsx            one row in the email stream
  EmailDetailModal.tsx    modal shown when an email is opened
  ConnectAccountModal.tsx "+ Connect account" modal — now links to
                          /api/auth/google for the real Gmail connection

lib/
  types.ts       Account, Email, Provider, ProviderFilter
  mock-data.ts   mockAccounts[], mockEmails[] — the 12 mock accounts /
                 10 mock emails Phase 3 layers the real Gmail account on
                 top of (see "Phase 3" section below for the new lib/ files)
```

Every row component (`AccountRow`, `ExpandedAccount`, `EmailRow`) receives
its data as props — none of them import mock data directly.

## Phase 3: Google OAuth + Gmail (new)

No new npm dependencies — OAuth and the Gmail REST calls are implemented
with plain `fetch` and Node's built-in `crypto`, nothing else.

```
lib/
  google-auth.ts   OAuth URL building, code/refresh-token exchange, token
                    revoke, and the Gmail API calls (list inbox, unread
                    count) — all plain fetch, no googleapis/next-auth
  session.ts        AES-256-GCM encrypt/decrypt for the session cookie
                    (keyed from AUTH_SECRET)
  constants.ts       REAL_GMAIL_ACCOUNT_ID — the reserved id (1000) used
                    to merge the one real account into the mock arrays
                    without colliding with mock ids 1-12 / 1-10

app/api/
  auth/google/route.ts                 GET  → redirects to Google's consent screen
  auth/google/callback/route.ts        GET  → exchanges code for tokens, sets session cookie
  auth/google/disconnect/route.ts      POST → revokes token, clears session cookie
  gmail/messages/route.ts              GET  → { connected, account, emails } for the
                                               logged-in Gmail account, refreshing the
                                               access token first if it's expired
```

`components/Dashboard.tsx` fetches `/api/gmail/messages` once on mount and
merges the result into the same `accounts`/`emails` state the mock data
already lives in — so every existing component (search, filters, the
inbox stream, the detail modal) works on the real account for free,
without ever knowing it's real. "Sync now" and "Disconnect" on that one
account are now wired to actually call Google instead of being no-ops.

### Setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create an
   OAuth 2.0 Client ID (type "Web application"), enable the **Gmail API**
   for the project, and add this Authorized redirect URI:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
2. Fill in `.env.local` (already git-ignored):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   AUTH_SECRET=...            # any long random string, e.g. `openssl rand -base64 32`
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```
3. While the Google Cloud project is in "Testing" publishing status, add
   the Gmail address you're testing with under **OAuth consent screen →
   Test users**, or Google will reject the login.
4. `npm install && npm run dev`, then click **+ Connect account → Continue
   with Google**.

### Known limitations / simplifications at this phase

- **Single account, Gmail only.** Reconnecting just re-authenticates the
  same slot (id `1000`) — there's no multi-account Gmail support and
  Outlook OAuth isn't implemented.
- **Read-only, inbox only.** Scope is `gmail.readonly`; no send, no
  archive/delete, no labels beyond reading `INBOX`/`UNREAD`.
- **Email body = Gmail's `snippet`** (~100 chars), not the full parsed
  MIME body — fetching/parsing full multipart bodies (text vs HTML,
  attachments) is real scope for a later phase, not added here.
- **No database.** The session (access + refresh token) lives only in an
  encrypted, httpOnly cookie. Nothing is persisted server-side, so there's
  nothing to clean up, but it also means the connection is tied to one
  browser.
- **Per-load API cost.** Each dashboard load/sync does 1 label call + 1
  list call + 1 metadata call per message (≈15 messages ⇒ ~17 Gmail API
  calls). Fine for a demo; worth batching or caching if this becomes a
  frequently-polled real feature.

### Not tested end-to-end here

This was implemented and type-checked (`tsc --noEmit` passes cleanly) in a
sandbox with no network access, so `npm run build`'s SWC binary download
and the actual Google OAuth redirect couldn't be exercised. Please run
`npm run dev` and click through **Connect account → Continue with Google**
yourself, and run `npm run build` before deploying — if anything breaks,
send me the error output and I'll fix it.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Production build

```bash
npm run build
npm start
```

## What still works (Phase 1/2 parity)

- Account search (filters the list live)
- All / Gmail / Outlook / Unread filter chips
- Click an account → expands it (one at a time)
- Inbox button → filters the right-side stream to that account
- Login ↗ → opens the real Gmail/Outlook site in a new tab (no password handling)
- Search all mail → filters by sender/subject/account
- Click an email row → detail modal, marks it read, updates unread counts
- ••• menu → Mark all read, Sync now, Account settings (mock), Disconnect
- + Connect account → **Continue with Google** now does a real OAuth
  connection for one Gmail account (see "Phase 3" above); everything else
  is still mock

## Known limitations (expected at this phase)

- The 11 mock Gmail accounts and 2 mock Outlook accounts are still
  in-memory only (`lib/mock-data.ts`) — refreshing the page resets their
  read/unread state and any disconnected mock accounts. The one real
  Gmail account re-syncs from the actual API on every load instead.
- Outlook OAuth isn't implemented — only Gmail.
- Desktop layout only — mobile responsiveness is a later phase.
- "Account settings" is still a no-op, matching the earlier phases' mock
  behavior; "Sync now" is real for the connected Gmail account and still a
  no-op for mock accounts.

## Deploying

Push this folder to a GitHub repo and import it into Vercel the same way
as before — Vercel auto-detects Next.js, so no manual Framework Preset
or Output Directory changes are needed this time (that override was only
required for the raw static HTML version).
