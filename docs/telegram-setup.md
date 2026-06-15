# Connecting Telegram

Telegram doesn't have a "click Connect and approve" flow like Google or
Slack — reading your personal chats uses Telegram's user API (MTProto),
which logs in with your **phone number and a code Telegram sends you**.
SignalDeck stores the resulting session **encrypted on your own machine**;
your phone number and code are never stored.

This is a one-time setup (~5 minutes).

## Step 1 — Get your API credentials

1. Go to <https://my.telegram.org> and log in with your phone number.
2. Open **API development tools**.
3. Create an app (any title, e.g. "SignalDeck"; platform "Other").
4. Copy your **`api_id`** (a number) and **`api_hash`** (a long string).

## Step 2 — Add them to your `.env`

```bash
TELEGRAM_API_ID="1234567"
TELEGRAM_API_HASH="abcdef0123456789abcdef0123456789"
```

Then restart so the worker picks them up:

```bash
docker compose up -d
```

## Step 3 — Log in once

Run the login command and follow the prompts (phone, the code Telegram
texts you, and your 2FA password if you have one):

```bash
npm run telegram:login
```

It logs in, saves an **encrypted** session to your database, and exits.
You won't need to do this again unless you log out.

## That's it

The background worker now reads your recent Telegram chats into the same
brief as your email — classified into *what needs you / can ignore* by your
chosen AI. The Telegram card on the dashboard turns green.

## Notes

- **Privacy:** the session is encrypted at rest with your `ENCRYPTION_KEY`,
  like every other credential. With a local AI (Ollama), your messages are
  never sent anywhere.
- **Read-only:** SignalDeck reads recent messages; it doesn't send anything
  or change your account.
- **Disconnect:** in Telegram, go to *Settings → Devices* and terminate the
  "SignalDeck" session anytime.
