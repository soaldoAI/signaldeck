# SignalDeck

**Privacy-first AI Personal Operations Centre.**

> Don't show me messages. Tell me what matters.

SignalDeck connects to your communication channels (Gmail and Google
Calendar in Community Edition), understands what's happening with the
AI provider *you* choose — including fully local Ollama — and delivers
one calm daily briefing: what's urgent, who needs a reply, what you're
waiting for, and what you can safely ignore.

It is not another inbox. It is an AI Chief of Staff that runs on your
own hardware.

## Status

Early development — **Phase 1 of 12** (repository scaffold). See
[ROADMAP.md](ROADMAP.md) for the build plan and
[PRODUCT.md](PRODUCT.md) for the product vision.

## Principles

- **Privacy first** — your data stays in your PostgreSQL database, on
  your machine. With Ollama, nothing ever leaves it.
- **Local-first** — self-hosted via Docker Compose; no SaaS dependency.
- **Open core** — Community Edition solves the problem completely.
  Pro will add channels and team features, never unlock basics.

## Quick start (development)

Prerequisites: Node.js ≥ 20, Docker.

```bash
git clone <repo-url> signaldeck && cd signaldeck
cp .env.example .env
docker compose up -d        # PostgreSQL + Mailpit (dev SMTP)
npm install
npx prisma generate
npm run dev                 # web app on http://localhost:3000
npm run worker              # background worker (separate terminal)
```

Mailpit catches all outbound mail in development — view it at
<http://localhost:8025>.

## Project layout

```
prisma/              Database schema and migrations
src/app/             Next.js App Router (UI + API routes)
src/server/          Server-only modules (each has a README)
  db/                Prisma client
  ai/                AI provider abstraction        (Phase 3)
  connectors/        Gmail, Calendar, …             (Phase 4+)
src/worker/          Background worker process
docker-compose.yml   Local services
```

## Documentation

- [PRODUCT.md](PRODUCT.md) — vision, principles, edition split
- [ROADMAP.md](ROADMAP.md) — milestones and status
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities

## License

Community Edition is licensed under [Apache 2.0](LICENSE).
