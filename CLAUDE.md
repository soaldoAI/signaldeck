@AGENTS.md

# SignalDeck — engineering guide

SignalDeck is an open-core, privacy-first **AI Personal Operations
Centre**. It does not show messages; it tells users what matters and
what to do next. Read [PRODUCT.md](PRODUCT.md) for what we build and
[ROADMAP.md](ROADMAP.md) for build order.

## The one question

Every feature, function, and dependency must answer:

> Does this help the user understand what they need to do next?

If not, simplify or remove it.

## Priorities (in order)

1. Privacy
2. Simplicity
3. Local-first
4. Easy installation
5. Clean architecture
6. Extensibility
7. Production quality

## Stack

- Next.js (App Router, `src/` layout) + TypeScript, strict mode
- PostgreSQL via Prisma
- Background worker: separate Node process (`npm run worker`)
- AI: provider abstraction over Anthropic / OpenAI / Ollama — never
  import a provider SDK outside `src/server/ai/`
- SMTP for outbound briefings (Mailpit in development)
- Docker Compose for local services and deployment

## Architecture rules

- `src/server/` is server-only; never import it from client components.
- Connectors (`src/server/connectors/`) produce normalised messages and
  know nothing about AI or UI. Everything downstream is source-agnostic.
- Each server module carries a README stating its contract. Update it
  when the contract changes.
- Community Edition must remain complete and useful. Never gate a core
  flow behind Pro; Pro extends, it does not unlock.

## Code standards

- Small functions, explicit types, maintainability over cleverness.
- No new dependency without a clear reason an existing one can't cover.
- Migrations via `prisma migrate dev` — never edit applied migrations.
- Backward compatibility: don't break existing user data or `.env`
  contracts; add, deprecate, then remove.

## Workflow

Local services: `docker compose up -d` (Postgres on 5432, Mailpit SMTP
on 1025 / UI on 8025). App: `npm run dev`. Worker: `npm run worker`.
Checks before finishing any task: `npm run lint` and `npm run build`.

At the end of every task: update documentation, suggest the next task,
identify technical debt, identify future improvements.
