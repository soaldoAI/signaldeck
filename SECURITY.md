# Security policy

SignalDeck handles people's private communications. Security and
privacy are the product, not a feature.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Email **security@signaldeck.dev** with:

- a description of the issue and its impact,
- steps to reproduce,
- affected version or commit.

You will receive an acknowledgement within 72 hours and a status
update at least every 7 days until resolution. We credit reporters in
release notes unless you prefer otherwise.

## Scope

- The SignalDeck application and worker
- The default Docker Compose deployment
- Handling of stored credentials (OAuth tokens, API keys, SMTP)

## Supported versions

Pre-1.0: only the latest release receives security fixes.

## Design commitments

- All user data lives in the user's own PostgreSQL instance.
- Message content is sent only to the AI provider the user explicitly
  configured; with Ollama it never leaves the machine.
- Connector credentials are stored encrypted at rest (from Phase 4).
- No telemetry, no phone-home, no third-party analytics.
