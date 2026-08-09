# Unified Inbox — Phase 2 (Next.js)

Converted from the working `index.html` prototype into a maintainable
Next.js + TypeScript app. No backend, database, or OAuth yet — this
phase is architecture only, functionality preserved 1:1.

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
  ConnectAccountModal.tsx placeholder modal for the "+ Connect account" button

lib/
  types.ts       Account, Email, Provider, ProviderFilter
  mock-data.ts   mockAccounts[], mockEmails[] — the ONLY file that
                 needs to change when this is wired to a real API/DB
```

Every row component (`AccountRow`, `ExpandedAccount`, `EmailRow`) receives
its data as props — none of them import mock data directly. When Phase 3+
replaces `lib/mock-data.ts` with real API calls, only `app/page.tsx` (and
eventually `Dashboard.tsx`'s data-fetching) needs to change.

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

## What still works (Phase 1 parity)

- Account search (filters the list live)
- All / Gmail / Outlook / Unread filter chips
- Click an account → expands it (one at a time)
- Inbox button → filters the right-side stream to that account
- Login ↗ → opens the real Gmail/Outlook site in a new tab (no password handling)
- Search all mail → filters by sender/subject/account
- Click an email row → detail modal, marks it read, updates unread counts
- ••• menu → Mark all read, Sync now (mock), Account settings (mock), Disconnect (removes account)
- + Connect account → shows the "OAuth will be implemented in the next phase" placeholder

## Known limitations (expected at this phase)

- All data is in-memory mock data (`lib/mock-data.ts`) — refreshing the
  page resets read/unread state and any disconnected accounts.
- No authentication, no database, no real Gmail/Outlook connection yet.
- Desktop layout only — mobile responsiveness is a later phase.
- "Sync now" and "Account settings" are no-ops for now, matching the
  Phase 1 prototype's mock behavior.

## Deploying

Push this folder to a GitHub repo and import it into Vercel the same way
as before — Vercel auto-detects Next.js, so no manual Framework Preset
or Output Directory changes are needed this time (that override was only
required for the raw static HTML version).
