# Server modules

Server-side code. Nothing here may be imported from client components.

| Module        | Phase | Responsibility                                  |
| ------------- | ----- | ----------------------------------------------- |
| `db/`         | 1     | Lazily-constructed Prisma client singleton.      |
| `auth/`       | 2     | Sessions, password hashing, setup/login guards.  |
| `crypto/`     | 2     | AES-256-GCM encryption for secrets at rest.      |
| `settings/`   | 2     | Typed key-value app configuration store.         |
| `mail/`       | 2     | SMTP delivery (nodemailer).                       |
| `delivery/`   | 9     | Pluggable briefing delivery (Gmail/SMTP/Telegram).|
| `validation.ts` | 2   | Zod schemas at the form/action trust boundary.   |
| `connectors/` | 2–6   | Connector registry, contract, normalisation.     |
| `ai/`         | 3     | Provider abstraction (Anthropic/OpenAI/Ollama).  |

## `server-only` vs shared services

Two kinds of server module live here, and the distinction matters
because the **background worker** (`src/worker/`) is a plain Node
process, not a Next.js bundle:

- **Next request layer** — `auth/session.ts`, `auth/index.ts`. These use
  `next/headers` / `next/navigation` (cookies, redirects) and carry
  `import "server-only"`. The worker never needs them.
- **Shared services** — `db/`, `crypto/`, `settings/`, `mail/`,
  `connectors/`. Used by both the app and the worker, so they must
  **not** import `server-only` (it throws outside the RSC bundler).
  They stay out of client bundles by convention and by importing
  `node:` built-ins (which Next refuses to bundle for the client).

When adding a module, ask: does the worker need it? If yes, keep it
free of `server-only` and of `next/*` imports.

## Secrets

Credentials (AI API keys, SMTP password, later OAuth tokens) are
encrypted with `crypto/` before storage and only ever decrypted
server-side. The encryption key comes from `ENCRYPTION_KEY`; everything
else a user configures is written through `settings/`, never to disk.
