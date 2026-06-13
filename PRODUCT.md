# SignalDeck

**AI Personal Operations Centre**

## Mission

Help busy professionals understand what needs their attention.
SignalDeck converts digital communications into actionable
intelligence.

> Don't show me messages. Tell me what matters.

## Hero feature

**The daily operational briefing** — one email (and dashboard view)
that tells you what your day actually requires.

## Questions SignalDeck answers

- What is urgent?
- What is outstanding?
- Who needs a reply?
- What am I waiting for?
- What changed?
- What can I ignore?

## Community Edition

Complete and useful on its own — never intentionally crippled.

- Gmail connector
- Google Calendar connector
- Dashboard
- Daily briefing
- Action extraction
- Suggested replies
- AI via Claude, OpenAI, or Ollama (fully local option)
- SMTP delivery
- Docker deployment
- Local-first, privacy-first architecture

## Future Pro

Pro extends the platform; it never unlocks withheld basics.

- Slack, Teams, LinkedIn, WhatsApp connectors
- Voice briefing
- Mobile
- CRM integration
- Team mode
- Executive assistant
- Operational Memory Graph

## Connection experience

SignalDeck must be usable by non-technical users. Connecting an
account should feel like installing Spotify or Slack.

- **OAuth first.** Click *Connect*, authenticate in a guided flow,
  done. Where OAuth is unavailable, fall back in order: browser
  extension → secure local export/import → (future) MCP connector.
- **No credential editing.** Users never touch API keys or config
  files to connect an account.
- **Connector catalogue.** The setup wizard shows available
  connectors; connecting is one click each.
- **Health indicators.** Every connected account shows its state:
  🟢 connected · 🟡 needs attention · 🔴 disconnected.
- **Under 10 minutes.** From install to configured.
- **Immediate payoff.** The first successful connection produces a
  Daily Brief right away — not tomorrow morning.

The platform is designed around *connectors*, not individual
platforms. Adding a new connector must require minimal architecture
change.

## Product principles

1. **Privacy** — your communications never leave your control.
2. **Calm interface** — no badges, no infinite feeds, no dopamine loops.
3. **Simple installation** — one `docker compose up` away.
4. **Action over information** — every screen ends in "do this".
5. **Reduce stress** — SignalDeck exists to shrink the worry list.
6. **Not another inbox** — we summarise and prioritise; we don't
   replicate.

## Primary users

Founders, executives, consultants, researchers, project managers,
government leaders — busy professionals drowning in channels.

## Success metric

A user opens their daily briefing and immediately knows what they need
to do today.
