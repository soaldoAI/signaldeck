# Delivery (Phase 9)

Where the daily briefing *lands*. Delivery is deliberately separate from
connectors: connectors are what SignalDeck **reads**, delivery is how the
finished briefing **reaches the user**. New delivery methods plug in the
same way connectors do — implement the contract, register it, done.

## Contract

Every delivery method implements:

- **describe** — id, name, icon; rendered where the user picks how their
  briefing arrives.
- **isConfigured** — whether this method is ready (e.g. Gmail connected,
  SMTP set, Telegram chat linked).
- **send** — deliver a rendered briefing (subject + text + html/markdown)
  for the current user.
- **health** — `connected` / `needs_attention` / `disconnected`, surfaced
  like connector health.

The briefing renderer produces one source document; each delivery method
formats it for its medium (HTML email vs. Telegram markdown).

## Methods

| Method        | Edition   | Notes                                                   |
| ------------- | --------- | ------------------------------------------------------- |
| Gmail API     | Community | **Default once Gmail is connected** — no SMTP needed.   |
| SMTP          | Community | Fallback for non-Gmail users / custom mail servers.     |
| Telegram      | Community | Free via the bot API; the first non-email option.       |
| WhatsApp      | Pro       | Requires the paid WhatsApp Business API.                |

`mail/mailer.ts` already implements SMTP send and is the seed of the SMTP
method. Gmail-API delivery depends on the Phase 4 Gmail connector's OAuth.

## Rules

- A delivery method never decides *what* is in the briefing — it only
  delivers. Content and prioritisation live upstream.
- Credentials (SMTP password, Telegram bot token) are stored encrypted
  via `settings/`, never hand-edited.
- Mailpit is a development inbox only; it is not a delivery method and is
  not a production dependency.
