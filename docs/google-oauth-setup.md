# Connecting Google (Gmail & Calendar)

SignalDeck connects to **your own Google account** using Google's official
sign-in (OAuth). Nothing is shared with SignalDeck's authors or any third
party — the connection is between *your* SignalDeck instance and *your*
Google account, and the access tokens are stored encrypted on your own
machine.

Because SignalDeck runs on your hardware, you create a small (free) Google
"OAuth client" once. This is the only manual setup step. It takes about 10
minutes and you only do it one time.

> **Why this step exists:** Google requires every app that reads Gmail to
> register with them. For a hosted SaaS the company does this once for
> everyone — but that means your email flows through their servers.
> SignalDeck is the opposite: *you* own the registration, so your data
> never leaves your control. This is the privacy trade-off, made in your
> favour.

---

## Step 1 — Create a Google Cloud project

1. Go to <https://console.cloud.google.com/>.
2. Click the project dropdown (top left) → **New Project**.
3. Name it anything (e.g. "SignalDeck") and click **Create**.

## Step 2 — Enable the APIs

1. In the search bar, search **"Gmail API"** → open it → **Enable**.
2. Search **"Google Calendar API"** → open it → **Enable**.
   (Calendar is used in Phase 5; enabling it now saves a trip back.)

## Step 3 — Configure the consent screen

1. Left menu → **APIs & Services → OAuth consent screen**.
2. User type: **External** → **Create**.
3. Fill in the required fields:
   - **App name**: SignalDeck
   - **User support email**: your email
   - **Developer contact email**: your email
4. **Scopes**: click **Add or remove scopes** and add:
   - `.../auth/gmail.readonly` — read your inbox
   - `.../auth/gmail.send` — send your daily briefing from your own Gmail
   - `.../auth/calendar.readonly` — read your calendar (Phase 5)
   - `.../auth/userinfo.email` — label the connected account
5. **Test users**: add **your own Google email address** here. This is
   important — only listed test users can connect.
6. Save.

> **Keep it in "Testing" mode.** You do *not* need to publish or verify the
> app — it's just for you. The one caveat: in Testing mode Google expires
> the refresh token roughly every 7 days, so you'll occasionally re-click
> *Connect*. SignalDeck shows a yellow "needs attention" indicator when
> that happens, so you always know. (Publishing to remove the limit
> requires Google's app-verification review, which isn't worth it for a
> personal instance.)

## Step 4 — Create the OAuth client

1. Left menu → **APIs & Services → Credentials**.
2. **Create credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Name: SignalDeck.
5. Under **Authorized redirect URIs**, add **exactly** this (it must match
   your `APP_URL`):
   - `http://localhost:3000/api/connectors/google/callback`
   - If you run SignalDeck on another address, use
     `<your APP_URL>/api/connectors/google/callback` instead.
6. Click **Create**. Google shows you a **Client ID** and **Client secret**.

## Step 5 — Give them to SignalDeck

Put the two values in your `.env` file, then restart:

```bash
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
```

```bash
docker compose up -d        # picks up the new values
```

That's it. In the dashboard, **Gmail** and **Google Calendar** will now
show a **Connect** button. Click it, choose your Google account, approve,
and SignalDeck starts building your briefing — all locally.

---

## What SignalDeck can and can't do with this

- **Can:** read your messages and calendar to understand what needs your
  attention, and send your briefing from your own address.
- **Can't:** delete your email, change your account, or send anything you
  didn't ask for. Read access is read-only.
- **Where your data lives:** in your own PostgreSQL database, on your
  machine. With a local AI (Ollama), message content never leaves it at
  all.
- **Revoking access:** remove SignalDeck anytime at
  <https://myaccount.google.com/permissions>, or disconnect it from the
  SignalDeck dashboard.
