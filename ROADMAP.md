# SignalDeck roadmap

Build order for Community Edition v1. Each phase ships working,
tested, documented code. Status: ✅ done · 🚧 in progress · ⬜ planned.

| Phase | Milestone                 | Status | Notes                                                        |
| ----- | ------------------------- | ------ | ------------------------------------------------------------ |
| 1     | Repository scaffold       | ✅     | Next.js + TS + Prisma + Docker Compose, docs, module layout. |
| 2     | Authentication & setup wizard | ✅ | Single-admin local auth (scrypt + DB sessions), encrypted secret store, first-run wizard (account + AI + SMTP + connector catalogue), dashboard shell. One-command Docker deploy. |
| 3     | AI provider abstraction   | ⬜     | One interface; Anthropic, OpenAI, Ollama implementations.    |
| 4     | Gmail connector           | ⬜     | One-click OAuth, incremental sync, health states, worker-driven. First sync fast enough for an immediate first brief. |
| 5     | Google Calendar connector | ⬜     | Events into the same pipeline.                               |
| 6     | Message normalisation     | ⬜     | Unified message model across sources.                        |
| 7     | AI classification engine  | ⬜     | Urgency, topic, needs-reply, ignorable.                      |
| 8     | Action extraction         | ⬜     | Concrete next actions, owners, due dates.                    |
| 9     | Daily briefing email      | ⬜     | The hero feature. SMTP delivery, calm design.                |
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
