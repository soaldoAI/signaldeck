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

Early development — **Phase 2 of 12** (authentication & setup wizard).
See [ROADMAP.md](ROADMAP.md) for the build plan and
[PRODUCT.md](PRODUCT.md) for the product vision.

## Principles

- **Privacy first** — your data stays in your PostgreSQL database, on
  your machine. With Ollama, nothing ever leaves it.
- **Local-first** — self-hosted via Docker Compose; no SaaS dependency.
- **Open core** — Community Edition solves the problem completely.
  Pro will add channels and team features, never unlock basics.

## Quick start — one command

Prerequisites: Docker. That's it.

```bash
git clone <repo-url> signaldeck && cd signaldeck
./scripts/start.sh
```

The script generates secure secrets on first run, then builds and
starts everything — database, mail server, web app, and background
worker. When it finishes, open <http://localhost:3000> and follow the
setup wizard (under 10 minutes). Outgoing mail is caught by the bundled
Mailpit server at <http://localhost:8025>.

To stop: `docker compose down`. Your data persists in a Docker volume.

## Local development

Prefer to run the app outside Docker while iterating:

```bash
cp .env.example .env
# set ENCRYPTION_KEY — e.g.  openssl rand -base64 32
docker compose up -d postgres mailpit   # just the backing services
npm install                              # runs prisma generate
npm run db:migrate                       # apply migrations
npm run dev                              # web app on :3000
npm run worker                           # background worker (separate terminal)
npm test                                 # unit tests
```

## Project layout

```
prisma/              Database schema and migrations
src/app/             Next.js App Router (wizard, login, dashboard)
src/server/          Server-side modules (each has a README)
  auth/              Sessions, password hashing, guards
  crypto/            Secret encryption at rest
  settings/          Typed app configuration store
  connectors/        Connector registry + contract  (Phase 4+)
  mail/              SMTP delivery
  ai/                AI provider abstraction        (Phase 3)
  db/                Prisma client
src/worker/          Background worker process
Dockerfile           Multi-stage build (app + worker)
docker-compose.yml   Full stack: db, mail, migrate, app, worker
scripts/start.sh     One-command bootstrap
```

## Configuration

Connecting accounts and choosing your AI provider happen in the setup
wizard, not in config files — you should never hand-edit API keys. The
only secret you manage is `ENCRYPTION_KEY`, which encrypts stored
credentials at rest (the start script generates it for you). See
[.env.example](.env.example) for all options.

## Documentation

- [PRODUCT.md](PRODUCT.md) — vision, principles, edition split
- [ROADMAP.md](ROADMAP.md) — milestones and status
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities

## License

Community Edition is licensed under [Apache 2.0](LICENSE).
