#!/usr/bin/env bash
#
# SignalDeck — one-command start.
#
#   ./scripts/start.sh
#
# Creates .env with secure secrets on first run, then builds and starts
# the whole stack (database, mail, web app, worker) with Docker Compose.
# When it finishes, open http://localhost:3000 and follow the wizard.

set -euo pipefail
cd "$(dirname "$0")/.."

# 1. Ensure .env exists with strong, stable secrets.
if [ ! -f .env ]; then
  echo "→ First run: creating .env with generated secrets…"
  cp .env.example .env

  ENCRYPTION_KEY="$(openssl rand -base64 32)"
  POSTGRES_PASSWORD="$(openssl rand -hex 16)"

  # Portable in-place edit (works on both GNU and BSD/macOS sed).
  tmp="$(mktemp)"
  sed -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"${ENCRYPTION_KEY}\"|" .env > "$tmp" && mv "$tmp" .env

  # Pin the database password so containers and the volume stay in sync.
  if grep -q "^POSTGRES_PASSWORD=" .env; then
    tmp="$(mktemp)"
    sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\"${POSTGRES_PASSWORD}\"|" .env > "$tmp" && mv "$tmp" .env
  else
    printf '\nPOSTGRES_PASSWORD="%s"\n' "${POSTGRES_PASSWORD}" >> .env
  fi
  echo "  .env created. Keep it safe — it holds your encryption key."
else
  echo "→ Using existing .env"
fi

# 2. Build and start everything.
echo "→ Building and starting SignalDeck…"
docker compose up -d --build

echo ""
echo "✓ SignalDeck is starting."
echo "  App:     http://localhost:${APP_PORT:-3000}"
echo "  Mail UI: http://localhost:${MAILPIT_UI_PORT:-8025}"
echo ""
echo "  Open the app and complete the setup wizard (under 10 minutes)."
echo "  Follow logs with:  docker compose logs -f app worker"
