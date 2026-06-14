# Connectors (Phase 4+)

One module per external source (Gmail, Google Calendar, …). The
platform is designed around connectors, not individual platforms:
adding a new source must require no architecture changes — implement
the contract, register it, done.

## Contract

Every connector implements the same interface:

- **describe** — name, icon, auth method; rendered in the setup
  wizard's connector catalogue.
- **authenticate** — guided flow, OAuth first. Fallback order when
  OAuth is unavailable: browser extension → secure local
  export/import → (future) MCP connector. Users never hand-edit
  credentials.
- **sync** — fetch new items since the last sync cursor.
- **normalise** — convert source items into SignalDeck's unified
  message model (Phase 6).
- **health** — report status for the UI: `connected` (green),
  `needs_attention` (yellow, e.g. token expiring), `disconnected`
  (red).

## Rules

- Connectors never call AI and never render UI. They produce
  normalised messages and health states; everything downstream
  (classification, actions, briefing) is source-agnostic.
- Credentials are stored encrypted at rest and only ever used
  server-side.
- A first successful sync must be fast enough to power an immediate
  first Daily Brief — sync recent items first, backfill later.

This is what makes Pro connectors (Slack, Teams, LinkedIn, WhatsApp)
a pure extension rather than a rewrite.

## Implemented

- **Gmail** (Phase 4) — `gmail/` (client + sync) over `google/oauth.ts`.
  One-click OAuth against the user's own Google account; tokens stored
  encrypted via `accounts.ts` (auto-refreshed, `needs_attention` health
  when re-auth is required). `sync.ts` pulls recent message metadata into
  the `messages` store, deduped per account; runs inline on connect and on
  a 5-minute worker schedule. Requires `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` — see `docs/google-oauth-setup.md`.

- **Google Calendar** (Phase 5) — `calendar/` (client + sync), reusing the
  same `google/oauth.ts` and `accounts.ts`. Per-connector scopes
  (`scopesForConnector`) with incremental auth, so connecting Calendar
  doesn't drop the Gmail grant. `sync.ts` refreshes the upcoming-events
  window into `calendar_events`; worker-scheduled like Gmail.

Connector account persistence (`accounts.ts`) and the OAuth helper
(`google/oauth.ts`) are source-agnostic — adding the Calendar connector
required no change to either, which is the contract working as intended.
