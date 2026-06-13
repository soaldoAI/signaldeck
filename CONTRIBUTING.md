# Contributing to SignalDeck

Thank you for helping build a calmer way to work.

## Before you start

- Read [PRODUCT.md](PRODUCT.md). Every contribution must pass the one
  question: *does this help the user understand what they need to do
  next?*
- Check [ROADMAP.md](ROADMAP.md) — we build in phases. Features ahead
  of the current phase are usually declined; open an issue to discuss
  first.

## Development setup

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma generate
npm run dev
```

## Standards

- TypeScript strict mode; explicit types on exported functions.
- Small functions; maintainability over cleverness.
- No new dependencies without discussion in the issue/PR.
- Server code stays in `src/server/`; never import it from client
  components.
- Database changes go through `prisma migrate dev` and ship with the
  PR. Never edit an applied migration.
- Update the relevant module README when you change a contract.

## Pull requests

1. Fork, branch from `main` (`feat/...`, `fix/...`).
2. Keep PRs focused — one change per PR.
3. `npm run lint` and `npm run build` must pass.
4. Add tests where behaviour is non-trivial.
5. Describe *why*, not just *what*, in the PR description.

## Security issues

Never open a public issue — see [SECURITY.md](SECURITY.md).
