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
