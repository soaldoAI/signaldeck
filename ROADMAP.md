# SignalDeck roadmap

Build order for Community Edition v1. Each phase ships working,
tested, documented code. Status: ✅ done · 🚧 in progress · ⬜ planned.

| Phase | Milestone                 | Status | Notes                                                        |
| ----- | ------------------------- | ------ | ------------------------------------------------------------ |
| 1     | Repository scaffold       | ✅     | Next.js + TS + Prisma + Docker Compose, docs, module layout. |
| 2     | Authentication & setup wizard | ✅ | Single-admin local auth (scrypt + DB sessions), encrypted secret store, first-run wizard (account + AI + SMTP + connector catalogue), dashboard shell. One-command Docker deploy. |
| 3     | AI provider abstraction   | ✅     | One `AiProvider` interface; fetch-based Anthropic/OpenAI/Ollama (no SDKs). Wizard "test connection" validates the choice with zero token cost. |
| 4     | Gmail connector           | ✅     | One-click Google OAuth (your own account), encrypted tokens w/ auto-refresh, worker-driven incremental sync into the unified messages store, dashboard health + recent activity. Immediate first sync on connect. |
| 5     | Google Calendar connector | ✅     | Reuses the Phase 4 OAuth/account layer; per-connector scopes (incremental auth). Worker syncs upcoming events into `calendar_events`; dashboard shows "Coming up". |
| 6     | Message normalisation     | ✅     | Unified `messages` store across sources (Gmail + Calendar feed one model the brain reads). |
| 7     | AI classification engine  | ✅     | Per-message triage via the configured provider (llama3.1 default): needs-reply / urgent / waiting / fyi / ignore + one-line summary. Robust parsing for local models; worker-driven, bounded per tick. |
| 8     | Action extraction         | ✅     | Concrete next action extracted per message in the same pass; surfaced as "What needs you". Owners/due-dates: future. |
| 9     | Daily briefing & delivery | ⬜     | The hero feature. Pluggable delivery: email via connected Gmail API (no SMTP) → SMTP fallback → Telegram (Community). WhatsApp delivery is Pro. Calm design. |
| 10    | Dashboard                 | ⬜     | Briefing view, actions, message drill-down.                  |
| 11    | Testing                   | ⬜     | Hardening pass; tests are also added per-phase.              |
| 12    | Documentation             | ⬜     | Install, configure, self-host, contribute.                   |

## Principles for sequencing

- Connectors before intelligence: real data first.
- Intelligence before presentation: the briefing is only as good as
  classification and extraction.
- Nothing in a later phase may be required to make an earlier phase's
  deliverable useful.

## Beyond v1 (Pro direction)

Slack / Teams / LinkedIn / WhatsApp connectors, voice briefing,
mobile, CRM, team mode, executive assistant, Operational Memory
Graph. See [PRODUCT.md](PRODUCT.md). Pro items are not built before
v1 unless the Community architecture requires the abstraction.
