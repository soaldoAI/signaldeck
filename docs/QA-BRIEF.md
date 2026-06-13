# SignalDeck — Integration Test Brief (Phases 1–2)

**Mission:** Independently verify, through black-box and white-box
integration testing, that SignalDeck's foundation (repository scaffold,
authentication, setup wizard, encrypted secret storage, and one-command
Docker deployment) is correct, secure, and matches its stated promises.
Find defects, weak spots, and privacy violations before Phase 3 builds on
top of it.

You are testing a **privacy-first, local-first, single-admin** self-hosted
app. Treat every privacy claim as a hypothesis to disprove.

---

## 1. Under test

- Repo: `https://github.com/soaldoAI/signaldeck` (branch `main`)
- Stack: Next.js 16 (App Router) · TypeScript · PostgreSQL · Prisma 7 ·
  Docker Compose · nodemailer (SMTP) · Vitest
- Scope: everything shipped in Phases 1–2. Connectors (Gmail/Calendar),
  AI calls, classification, and the daily briefing are **not built yet**
  — see "Accepted limitations".

### Environment

Two profiles — test both:

**A. One-command (primary, what real users do)**
```bash
git clone https://github.com/soaldoAI/signaldeck && cd signaldeck
./scripts/start.sh
# open http://localhost:3000
```

**B. Local dev (for white-box work)**
```bash
cp .env.example .env          # set ENCRYPTION_KEY: openssl rand -base64 32
docker compose up -d postgres mailpit
npm install
npm run db:migrate
npm run dev                   # :3000
npm run worker                # separate terminal
npm test                      # unit suite (expect 15 passing)
```

Prerequisites: Docker, Node ≥ 20. DB inspection:
`docker compose exec postgres psql -U signaldeck -d signaldeck`.
Mail UI: `http://localhost:8025`.

---

## 2. Specification — the behavior to hold the build to

**Routes** (all server-rendered/dynamic): `/setup`, `/login`, `/`
(dashboard).

**Setup wizard (`/setup`)** — available only until the single admin
exists. Collects: email, password (min 8), AI provider
(`anthropic`/`openai`/`ollama`), optional model, the credential for the
chosen provider, and SMTP host/port/user/password/from. On success:
creates the admin, stores config, signs the user in (sets cookie),
redirects to `/`. Conditional rules: Claude requires an Anthropic key,
OpenAI requires an OpenAI key, Ollama requires a server URL.

**Auth**
- Passwords hashed with scrypt; stored as `salt:derivedKey` (hex). No
  plaintext password anywhere.
- Sessions are database-backed. The cookie `signaldeck_session` holds a
  random opaque token; the DB stores only its **SHA-256 hash**. TTL 30
  days. Cookie is `httpOnly`, `SameSite=Lax`, and `Secure` **only when
  `APP_URL` is https** (so LAN-over-http self-hosting still works).
- Guards: unauthenticated `/` → redirect to `/setup` (if unconfigured)
  or `/login`. `/setup` after setup is complete → `/login`. `/login`
  while already authenticated → `/`.
- Login failures return a single generic message ("Invalid email or
  password.") whether or not the email exists.

**Secrets at rest** — AI API keys and the SMTP password are encrypted
with AES-256-GCM before being written to the `settings` table
(`encrypted = true`). Encryption key derives from `ENCRYPTION_KEY`.
Non-secret settings (provider, model, host, port, from) are stored in
clear. **No secret value may appear in plaintext in the database or in
logs.**

**Data model** — tables `users`, `sessions`, `settings`,
`_prisma_migrations`. Exactly one user (single-tenant).

**One-command deploy** — `scripts/start.sh` generates `ENCRYPTION_KEY`
and a Postgres password into `.env` on first run, then
`docker compose up -d --build` brings up five services: `postgres`,
`mailpit`, `migrate` (one-shot, runs `prisma migrate deploy` then exits
0), `app`, `worker`. App and worker must wait for `migrate` to complete.

**Worker** — separate process; logs `[worker] SignalDeck worker started`,
stays alive, shuts down cleanly on SIGINT/SIGTERM.

**Privacy posture** — no telemetry, no phone-home, no third-party
analytics. With Ollama selected, no message content should ever leave the
host.

---

## 3. Black-box test suite (user/API perspective)

Verify behavior, not code. For each, record expected vs actual.

**B1 — One-command deploy.** Fresh clone, no `.env`. Run
`./scripts/start.sh`. Expect: `.env` created with a populated
`ENCRYPTION_KEY`; all five services start; `migrate` exits 0; app answers
200 at `/setup` within ~60s. Re-run the script — expect it reuses the
existing `.env` (does not regenerate secrets) and comes back up.

**B2 — Happy-path onboarding (Ollama).** Complete the wizard with the
Ollama provider and default SMTP. Expect redirect to dashboard, your
email shown, all three connectors listed with neutral status and a
disabled Connect button. Time the whole clone→dashboard run; the product
target is **under 10 minutes**.

**B3 — Provider switching.** In the wizard, switch between Ollama / Claude
/ OpenAI. Expect the credential field to change accordingly (API key vs
Ollama URL). Submit Claude with an empty key → expect a field-level
validation error, no account created. Repeat for OpenAI.

**B4 — Validation.** Submit: invalid email; 7-char password; non-numeric
SMTP port; empty From. Each must produce a clear error and **must not**
create a user or partial config. Confirm `users` is still empty after a
rejected submit.

**B5 — Setup is one-time.** After completing setup, navigate to `/setup`
→ expect redirect to `/login`. Replay the setup POST a second time (e.g.
resend the form) → expect rejection ("already set up"), and confirm no
second user appears.

**B6 — Login / logout.** Log out → expect redirect to `/login` and that
`/` now redirects to `/login`. Log in with the wrong password, then a
wrong email → both give the same generic error. Log in correctly →
dashboard. Confirm the session survives a browser refresh and an
`docker compose restart app`.

**B7 — Guard matrix.** With and without a valid session cookie, hit `/`,
`/setup`, `/login` and a non-existent route. Record every status code and
redirect target. No protected content should ever render without a valid
session.

**B8 — Cookie attributes.** Inspect the `signaldeck_session` cookie.
Expect `HttpOnly` and `SameSite=Lax`. Over `http://localhost`, confirm
login works. Then set `APP_URL=https://…`, restart, and confirm the
cookie gains `Secure`.

**B9 — Persistence.** Create data, `docker compose down` (without `-v`),
`up` again. Expect the admin account and settings to survive (Postgres
volume). Then confirm a logged-in session behaves correctly across the
restart.

**B10 — Mail plumbing.** Confirm Mailpit UI loads at `:8025`. (No app
mail is sent yet — note that as expected, not a bug.)

---

## 4. White-box test suite (code/data perspective)

Read the source and probe internals. Key files:
`src/server/crypto/secrets.ts`, `src/server/auth/{password,session,index}.ts`,
`src/server/settings/index.ts`, `src/server/validation.ts`,
`src/server/db/client.ts`.

**W1 — Encryption at rest (the headline privacy claim).** Complete setup
with a Claude key like `sk-ant-CANARY-12345`. Then:
```sql
SELECT key, encrypted, value FROM settings;
```
Expect `ai.anthropicApiKey` and `smtp.password` rows with `encrypted=t`
and ciphertext; grep the entire DB dump for `CANARY` → **must not
appear**. Confirm non-secret keys (`ai.provider`, `smtp.host`) are clear.

**W2 — Crypto correctness.** From `secrets.ts`: verify AES-256-GCM,
random 12-byte IV, format `iv:authTag:ciphertext` (base64). Write a quick
harness (or extend the Vitest suite) to confirm: round-trip works; the
same input yields different ciphertext (unique IV); a wrong
`ENCRYPTION_KEY` fails to decrypt; a tampered ciphertext throws (GCM auth
tag); `ENCRYPTION_KEY` shorter than 16 chars throws. (These have unit
tests — re-run `npm test` and also try to break them.)

**W3 — Password hashing.** Confirm scrypt, per-hash random salt (two
hashes of the same password differ), constant-time comparison
(`timingSafeEqual`), and that a malformed stored hash returns false
rather than throwing.

**W4 — Session integrity.** After logging in, compare the cookie token to
`sessions.tokenHash` in the DB — the raw token must **not** be stored
(only its SHA-256). Confirm logout deletes the row. Force an expired
session (set `expiresAt` in the past via SQL) and confirm the next request
is treated as logged-out and the row is cleaned up. Try presenting a
fabricated/expired token → no access.

**W5 — Injection.** Put SQL/`'`/`;`/`--` and template-ish payloads into
email, From, model, and Ollama URL fields. Prisma should parameterize —
confirm no SQL error and no injection. Put `<script>` / HTML into the
email and From fields; view the dashboard and any reflection point →
confirm React escapes it (no XSS).

**W6 — Mass assignment / extra fields.** POST the setup/login actions with
extra unexpected fields and with secret keys for a provider you didn't
select (e.g. provider=ollama but also send anthropicApiKey). Confirm only
expected data is persisted and nothing unexpected is trusted.

**W7 — Validation boundaries.** Exercise `setupSchema`/`loginSchema`
directly: boundary password length (7 vs 8), port `0`/negative/huge,
whitespace-only fields, unicode/very long inputs. Behavior should match
the schema with no crashes.

**W8 — `server-only` boundary.** Confirm the architecture rule holds:
`auth/session.ts` and `auth/index.ts` carry `import "server-only"`, while
shared services (`db`, `crypto`, `settings`, `mail`, `connectors`) do
**not** (the worker imports them). Try importing a `server-only` module
into a client component → the build must fail. Inspect the client JS
bundle (`.next`) for any leaked secret-handling code or env secrets.

**W9 — Build without a database.** `npm run build` with `DATABASE_URL`
unset should succeed (lazy Prisma client). Confirm.

**W10 — Migration idempotency.** Run `prisma migrate deploy` twice →
second run reports nothing pending, exit 0. Confirm the schema matches
`schema.prisma`.

**W11 — Secret leakage in logs.** Watch `docker compose logs app worker
migrate` throughout. No API key, password, session token, or
`ENCRYPTION_KEY` may appear. Trigger an error path (e.g. bad SMTP) and
confirm the error message doesn't echo secrets.

---

## 5. Integration / infrastructure suite

**I1 — Service orchestration.** `docker compose ps -a` after `up`: expect
`postgres`+`mailpit` healthy, `migrate` Exited(0), `app`+`worker` Up.
Confirm app/worker did **not** start before `migrate` finished (check log
ordering).

**I2 — Worker lifecycle.** Confirm the worker stays up (does not exit/
restart-loop). `docker compose kill -s SIGTERM worker` (or stop) → expect
a clean shutdown log, not a crash.

**I3 — Env propagation.** Inside the app container, `DATABASE_URL` points
at host `postgres`, `SMTP_HOST` at `mailpit`. Confirm the wizard's SMTP
host default reflects the container env (`mailpit`), not `localhost`.

**I4 — Rebuild/upgrade.** `docker compose up -d --build` over a running
stack → app/worker rebuild and reconnect; data intact.

**I5 — Image hygiene.** App image is the lean Next standalone (no full
`node_modules`/Prisma CLI); worker image carries the full tree. Sanity-
check image sizes and that the app image has no `.env` baked in.

---

## 6. Security suite

**S1 — No egress / no telemetry.** Monitor outbound network from the
containers during setup and idle (e.g. `docker run`-level capture or host
firewall logs). With Ollama selected and no real connectors, expect **no
outbound traffic to third parties**. Flag any phone-home.

**S2 — Auth bypass attempts.** Direct-load `/` with: no cookie; a random
cookie; another user's-shaped token; a tampered token (flip a char).
None may grant access.

**S3 — Session handling.** Check for session fixation (token rotates on
login), cookie scope/path, and that logout fully invalidates server-side
(reusing the old token after logout fails).

**S4 — Dependency & secret hygiene.** `npm audit` (record High/Critical).
Confirm `.env` is gitignored and `.env.example` ships no real secrets.
Confirm `ENCRYPTION_KEY` is required and the app refuses to encrypt with a
weak/missing key.

**S5 — Brute force surface.** Note that `/login` has **no rate limiting**
(known/accepted for now) — confirm there's at least no account lockout
bug and no timing oracle distinguishing valid vs invalid emails.

---

## 7. Accepted limitations — do NOT file these as bugs

Verify they behave as described, but they are intentional at this stage:

- Connectors (Gmail, Calendar, Slack) are listed but **not connectable**
  (Connect is disabled). No real message sync, AI, classification, or
  daily briefing yet.
- No post-setup settings UI (config changes require DB access).
- `/login` has no rate limiting / CAPTCHA.
- The wizard has no "send test email" button wired yet.
- CI workflow is not yet active on GitHub.
- Single admin only; no multi-user, no password reset flow.

If any of these is **broken** (e.g. a disabled Connect button actually
fires, or a "coming soon" path leaks an error), that *is* reportable.

---

## 8. How to report results

Return: (a) a one-paragraph **summary verdict** (ship-ready for Phase 3 or
not, and why), (b) a **coverage table** (which test IDs ran:
pass/fail/blocked), and (c) a **findings list**. Use this format per
finding:

```
ID:          F-001
Title:       <short, specific>
Type:        black-box | white-box | integration | security
Severity:    Critical | High | Medium | Low | Info
Component:   <file/route/service>
Test ref:    <e.g. W1>
Steps:       <numbered, reproducible>
Expected:    <per the spec in §2>
Actual:      <what happened>
Evidence:    <command output, SQL result, screenshot, log excerpt>
Suggested fix: <optional>
```

**Severity guide:**
- **Critical** — secret stored/leaked in plaintext, auth bypass, RCE/SQLi,
  data loss.
- **High** — a security control missing/ineffective, broken one-command
  deploy, session not invalidated on logout.
- **Medium** — validation gap, incorrect guard/redirect, crash on bad
  input, secret in logs on an error path.
- **Low** — cosmetic, minor UX, non-ideal defaults.
- **Info** — observations, hardening suggestions, test debt.

Prioritize **W1, W4, W8, W11, S1, S2** — those directly test the
privacy-first and auth promises the whole product rests on. A green run
there matters more than any feature polish.
