# SignalDeck — Integration Test Results (Phases 1–2)

**Tester:** independent QA (automated agent)
**Date:** 2026-06-13
**Build under test:** `main` @ `fe1b78a` (Phase 1–2)
**Environment:** macOS (darwin 25.5.0), Node v22.18.0, Docker 28.3.2. Both
profiles exercised — one-command Docker stack (`./scripts/start.sh`) and
local-dev (host `next dev` + `npm run worker` against `docker compose`
postgres/mailpit).

---

## (a) Summary verdict

**Ship-ready for Phase 3 — with two Medium config/privacy fixes recommended
first.** The privacy- and auth-critical foundation is solid: every priority
test passed cleanly. Secrets are AES-256-GCM encrypted at rest (a canary key
never appears in a full DB dump), session tokens are stored only as SHA-256
hashes (raw token never persisted), logout and expiry delete the row and
revoke access server-side, all auth-bypass attempts are rejected, the
`server-only` boundary is enforced by the build, the client bundle leaks no
secret code, Prisma parameterizes (no SQLi), and no secret appears in any
container log. 15/15 unit tests pass; build succeeds without a database; the
one-command deploy comes up in ~25s with correct service orchestration and
data persistence across restarts.

Two issues should be triaged before building on top: **(F-001, Medium)** the
bundled SMTP host default resolves to `localhost` inside the containers
instead of `mailpit`, so the wizard pre-fills an address that can't reach the
bundled mail server (breaks the documented out-of-the-box mail path and will
bite the Phase 9 briefing); and **(F-002, Medium)** Next.js telemetry is left
enabled, so `next build`/`next dev` phone home to `telemetry.nextjs.org` —
which contradicts the product's headline "no telemetry / no phone-home"
promise and happens on the *user's* machine during one-command install.
Neither blocks Phase 3 functionally, but both touch stated promises. The
remaining findings are Low/Info hardening notes.

---

## (b) Coverage table

| ID | Area | Result | Note |
|----|------|--------|------|
| B1 | One-command deploy (fresh + re-run) | **PASS** | up in ~25s; `.env` generated w/ key; re-run reuses `.env`, no secret regen |
| B2 | Happy-path onboarding (Ollama) | **PASS** | 303→`/`, email shown, connectors listed w/ disabled Connect |
| B3 | Provider switching / credential rules | **PASS** | empty Anthropic & OpenAI keys rejected, no account created |
| B4 | Validation (email/pw/port/from) | **PASS** | all 4 invalid submits → 200 re-render, `users` stays 0 |
| B5 | Setup is one-time | **PASS** | replay POST → 307 `/login`, no 2nd user |
| B6 | Login / logout | **PASS** | generic error both cases; logout 303→`/login`, cookie cleared |
| B7 | Guard matrix | **PASS** | all states correct (see detail below) |
| B8 | Cookie attributes | **PASS** | `HttpOnly; SameSite=lax`; gains `Secure` only under `APP_URL=https` |
| B9 | Persistence across restart | **PASS** | user + 10 settings survive `down`/`up` (no `-v`) |
| B10 | Mail plumbing (Mailpit UI) | **PASS** | UI 200 at `:8025` |
| W1 | Encryption at rest | **PASS** ★ | secrets `encrypted=t` ciphertext; **0** CANARY hits in full DB dump |
| W2 | Crypto correctness | **PASS** | AES-256-GCM, 12-byte IV, `iv:authTag:ciphertext` b64; 5 unit tests pass |
| W3 | Password hashing | **PASS** | scrypt, random salt, `timingSafeEqual`, malformed→false |
| W4 | Session integrity | **PASS** ★ | `tokenHash`=SHA-256(cookie); logout & expiry delete row + revoke |
| W5 | Injection (SQL / XSS) | **PASS** | SQLi parameterized, no error, table intact; XSS gated by schema + React escaping |
| W6 | Mass assignment | **PASS\*** | structural fields ignored (id is server cuid); see **F-003** (stray keys persisted) |
| W7 | Validation boundaries | **PASS** | matches schema, no crashes; see **F-004** (no port/length caps) |
| W8 | `server-only` boundary | **PASS** ★ | build fails on client import; client bundle has no secret code/keys |
| W9 | Build without DB | **PASS** | `next build` succeeds, `DATABASE_URL` unset |
| W10 | Migration idempotency | **PASS** | 2nd `migrate deploy` = nothing pending; 4 expected tables |
| W11 | Secret leakage in logs | **PASS** ★ | 0 hits for keys/passwords/tokens across app+worker+migrate logs |
| I1 | Service orchestration | **PASS** | pg/mailpit healthy, migrate Exited(0), app/worker after migrate |
| I2 | Worker lifecycle | **PASS** | RestartCount 0; SIGTERM → clean shutdown log, exit 0, 283ms |
| I3 | Env propagation | **FAIL** | **F-001**: container `SMTP_HOST=localhost`, not `mailpit` |
| I4 | Rebuild / upgrade | **PASS** | rebuild over running stack; data intact |
| I5 | Image hygiene | **PASS** | app 421MB lean standalone (no prisma CLI, no `.env`); worker 1.52GB full tree |
| S1 | No egress / telemetry | **PASS\*** ★ | runtime egress = internal pg only; see **F-002** (build/dev telemetry) |
| S2 | Auth bypass | **PASS** ★ | empty/random/fabricated/tampered cookie → `/login`; only genuine = 200 |
| S3 | Session handling | **PASS** | token server-issued (no fixation); logout invalidates server-side |
| S4 | Dependency & secret hygiene | **PASS** | `.env` gitignored, `.env.example` clean, key required; see **F-005** (5 moderate) |
| S5 | Brute-force / timing | **PASS** | interleaved timing delta ≈ −0.3ms (~1%, noise); no oracle |

★ = priority test. **PASS\*** = passes the core assertion but carries a finding.

**Guard matrix detail (B7):**

| Route | unconfigured | authenticated | unauth (setup done) |
|-------|-------------|---------------|---------------------|
| `/` | 307 → `/setup` | 200 | 307 → `/login` |
| `/setup` | 200 | 307 → `/login` | 307 → `/login` |
| `/login` | 307 → `/setup` | 307 → `/` | 200 |
| `/nope` | 404 | 404 | 404 |

---

## (c) Findings

```
ID:          F-001
Title:       Bundled SMTP host default resolves to `localhost` inside containers, not `mailpit`
Type:        integration
Severity:    Medium
Component:   .env.example:26 · docker-compose.yml (x-app-env SMTP_HOST) · scripts/start.sh · src/app/setup/page.tsx
Test ref:    I3 (also B2)
Steps:
  1. ./scripts/start.sh (fresh clone) — start.sh does `cp .env.example .env`.
  2. docker compose exec app sh -c 'echo $SMTP_HOST'   → localhost
  3. curl -s http://localhost:3000/setup | grep smtpHost  → value="localhost"
  4. From inside the app container, `localhost` is the container itself (no
     SMTP listener); the bundled mail server is the service `mailpit`.
Expected:    SMTP_HOST inside containers = `mailpit`; wizard pre-fills `mailpit`
             (docker-compose declares `SMTP_HOST: ${SMTP_HOST:-mailpit}`).
Actual:      .env.example ships `SMTP_HOST="localhost"`; start.sh copies it to
             .env; compose interpolates that value, so `${SMTP_HOST:-mailpit}`
             never falls back to `mailpit`. Wizard default = localhost.
Evidence:    `docker compose config` → `SMTP_HOST: localhost`; wizard input
             value="localhost"; comment in setup/page.tsx claims it should be
             `mailpit` in Docker.
Impact:      Out-of-the-box mail (and the Phase 9 briefing) will fail to reach
             the bundled Mailpit if the user accepts the default. DATABASE_URL
             (→ postgres) is unaffected and correct.
Suggested fix: Remove `SMTP_HOST` from .env.example (let compose default to
             `mailpit`), OR set it to `mailpit`, OR drop the host-default from
             .env.example so the compose `:-mailpit` fallback applies.
```

```
ID:          F-002
Title:       Next.js telemetry left enabled — build/dev phone home to telemetry.nextjs.org
Type:        security (privacy)
Severity:    Medium  (arguably High — "no telemetry/phone-home" is privacy priority #1)
Component:   Dockerfile (build/runtime stages) · next.config.ts · scripts/start.sh
Test ref:    S1
Steps:
  1. grep -r NEXT_TELEMETRY_DISABLED Dockerfile docker-compose.yml next.config.ts → not set anywhere.
  2. npx next telemetry status → "Status: Enabled".
Expected:    No telemetry / no phone-home (PRODUCT + spec §2 Privacy posture).
Actual:      Telemetry enabled by default. `next build` (runs during the Docker
             image build on the USER's machine via start.sh) and `next dev`
             collect and send anonymized events to telemetry.nextjs.org.
Evidence:    `Status: Enabled` from next CLI; no disable flag in repo.
Note:        Production runtime (`node server.js`) does NOT emit telemetry —
             runtime egress check showed only the internal postgres connection
             (172.20.0.3:5432), no third-party traffic. Exposure is build/dev-time.
Suggested fix: Add `ENV NEXT_TELEMETRY_DISABLED=1` to the Dockerfile (base or
             build + app stages) and document it; optionally export it in
             start.sh for host builds.
```

```
ID:          F-003
Title:       Provider credentials for unselected providers are persisted
Type:        white-box
Severity:    Low
Component:   src/server/settings/index.ts (saveAiConfig) · src/app/setup/actions.ts
Test ref:    W6
Steps:
  1. POST /setup with aiProvider=ollama AND anthropicApiKey=sk-ant-STRAY... AND openaiApiKey=...
  2. SELECT key, encrypted FROM settings;
Expected:    Only the selected provider's credential is trusted/persisted.
Actual:      ai.anthropicApiKey and ai.openaiApiKey are stored (encrypted=t)
             even though provider=ollama. saveAiConfig writes every key
             unconditionally via writeMany.
Evidence:    settings table shows encrypted ai.anthropicApiKey/ai.openaiApiKey
             rows after an Ollama setup carrying stray keys.
Impact:      Low — values are encrypted at rest and unused at runtime; the
             normal wizard only renders the selected provider's field, so this
             requires a crafted POST. Data-minimization / least-surprise gap.
Note:        Structural mass-assignment IS blocked — injected id/isAdmin/role
             were ignored (user id is a server-generated cuid).
Suggested fix: In completeSetup (or saveAiConfig), only pass the credential for
             the chosen provider; null/skip the others.
```

```
ID:          F-004
Title:       Validation hardening gaps (no SMTP port ceiling, no input length caps)
Type:        white-box
Severity:    Info / Low
Component:   src/server/validation.ts
Test ref:    W7
Steps:       Exercised setupSchema directly with boundary inputs.
Findings:    smtpPort accepts 99999999 (only `int().positive()`, no ≤65535
             ceiling); email and password have no max length (100k-char
             password accepted → scrypt cost unbounded); IDN/unicode emails
             rejected by zod `.email()`. No crashes in any case (matches schema).
Suggested fix: `.max(65535)` on port, `.max()` on email/password; consider
             whether IDN email support is desired.
```

```
ID:          F-005
Title:       5 moderate npm audit advisories (build/dev deps)
Type:        security
Severity:    Info
Component:   package-lock.json
Test ref:    S4
Evidence:    `npm audit` → 0 critical, 0 high, 5 moderate:
             postcss <8.5.10 (XSS in CSS stringify, via next build dep);
             @hono/node-server (middleware bypass) via @prisma/dev (Prisma CLI).
Impact:      All in build/dev-time tooling, not the runtime app/worker image.
             Fixes are `--force` major bumps (next/prisma) — defer.
```

```
ID:          F-006
Title:       Worker logs ".env not found" twice on container start
Type:        integration
Severity:    Info
Component:   package.json (worker script: tsx --env-file-if-exists=.env) · Docker worker stage
Test ref:    I2
Actual:      Container worker prints ".env not found. Continuing without it."
             twice. Correct behavior (env comes from compose, .env isn't baked
             into the image) but the duplicated notice is noisy/confusing.
Suggested fix: Cosmetic — drop the host-oriented --env-file flag in the
             container command, or document that the notice is expected.
```

### Notes on accepted limitations (§7) — verified behaving as intended
- Connectors listed but not connectable; Connect button is `disabled` and
  inert (no fire on POST). Dashboard empty-state renders correctly.
- No post-setup settings UI; `/login` has no rate limiting (S5 confirms no
  lockout bug and no timing oracle); no "send test email" button wired; CI
  workflow present but not active; single admin only.
