#!/usr/bin/env bash
# Runs before the frontend starts on every boot. This instance has no fixed
# (Elastic) IP, so it gets a new public address every time it stops/starts
# (e.g. via the idle-shutdown timer). Next.js bakes NEXT_PUBLIC_API_URL into
# the build at compile time, so a stale address means a dead frontend until
# someone rebuilds it — this makes that automatic instead.
set -euo pipefail

ENV_FILE="/opt/mediadl/frontend/.env.local"
NEW_IP=$(curl -sf --max-time 10 https://checkip.amazonaws.com) || exit 0
[[ -n "$NEW_IP" ]] || exit 0

CURRENT=$(grep -oP '(?<=NEXT_PUBLIC_API_URL=http://)[^:]+' "$ENV_FILE" 2>/dev/null || true)

if [[ "$NEW_IP" != "$CURRENT" ]]; then
  echo "public IP changed ($CURRENT -> $NEW_IP) — updating and rebuilding frontend"
  if grep -q '^NEXT_PUBLIC_API_URL=' "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${NEW_IP}:4000|" "$ENV_FILE"
  else
    echo "NEXT_PUBLIC_API_URL=http://${NEW_IP}:4000" >> "$ENV_FILE"
  fi
  cd /opt/mediadl/frontend
  npm run build
else
  echo "public IP unchanged ($NEW_IP) — no rebuild needed"
fi
