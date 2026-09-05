#!/usr/bin/env bash
# Expose the local backend so the Telegram bot's download links work from any
# device / network (not just the same Wi-Fi). Uses a free Cloudflare quick
# tunnel — no account, no domain. The URL changes every run.
#
#   winget install Cloudflare.cloudflared     # or: brew install cloudflared
#   bash deploy/tunnel.sh
#
# It prints a https://<random>.trycloudflare.com URL, writes it to
# BOT_PUBLIC_BASE_URL in .env, and restarts the bot process for you to pick up.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v cloudflared >/dev/null || { echo "install cloudflared first"; exit 1; }

echo "starting tunnel to http://localhost:4000 …"
cloudflared tunnel --url http://localhost:4000 --no-autoupdate > /tmp/mediadl-tunnel.log 2>&1 &
TPID=$!
trap 'kill $TPID 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/mediadl-tunnel.log | head -1 || true)
  [[ -n "${URL:-}" ]] && break
  sleep 1
done
[[ -n "${URL:-}" ]] || { echo "tunnel didn't come up — see /tmp/mediadl-tunnel.log"; exit 1; }

echo "tunnel: $URL"
if grep -q '^BOT_PUBLIC_BASE_URL=' .env; then
  sed -i "s#^BOT_PUBLIC_BASE_URL=.*#BOT_PUBLIC_BASE_URL=$URL#" .env
else
  echo "BOT_PUBLIC_BASE_URL=$URL" >> .env
fi
echo "wrote BOT_PUBLIC_BASE_URL to .env — restart the bot (npm run dev:bot) to use it."
echo "leave this window open; Ctrl+C ends the tunnel."
wait $TPID
