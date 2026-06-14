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
- Briefing delivery: email (via connected Gmail or SMTP) **or Telegram**
- Action extraction
- Suggested replies
- AI via Claude, OpenAI, or Ollama (fully local option)
- Docker deployment
- Local-first, privacy-first architecture

## Future Pro

Pro extends the platform; it never unlocks withheld basics.

- Slack, Teams, LinkedIn, WhatsApp, Telegram, Messenger connectors
- Briefing delivery to WhatsApp
- Voice briefing
- Mobile
- CRM integration
- Team mode
- Executive assistant
- Operational Memory Graph

## How the briefing is delivered

Channels (above) are what SignalDeck *reads*. Delivery is *where the
briefing lands* — a separate concern, designed as its own pluggable
abstraction so new delivery methods drop in like connectors do.

- **Email is the default**, sent through the user's own mail. Two paths:
  - **Via your connected Gmail.** Once Gmail is connected (OAuth),
    SignalDeck can send the briefing through the Gmail API using that
    same authorisation — **no SMTP setup at all**. This is the goal for
    the simplest, most non-technical install.
  - **Via SMTP**, for users who don't connect Gmail or who want a
    specific mail server. Configured once in the wizard.
- **Telegram delivery (Community).** Get the briefing as a Telegram
  message instead of an email — free and simple via the Telegram bot
  API, so it ships in Community Edition.
- **Mailpit is development only** — a local inbox that catches outgoing
  mail so the briefing can be tested without sending anything real. It
  is never required in production and is not a dependency of the app.
- **Future Pro: WhatsApp delivery.** Get the briefing on WhatsApp;
  requires the paid WhatsApp Business API, so it lands in Pro.

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
