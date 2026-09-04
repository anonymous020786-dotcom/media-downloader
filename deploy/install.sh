#!/usr/bin/env bash
# MediaDL — bot-only VPS install (Ubuntu 22.04 / 24.04 / 26.04).
#
#   Runs python-service (127.0.0.1:8000) + backend (127.0.0.1:4000) + the
#   Telegram bot. NOT the web UI. No inbound ports except SSH.
#
# Usage (as root):
#   git clone https://github.com/anonymous020786-dotcom/media-downloader.git /opt/mediadl
#   cd /opt/mediadl/deploy && bash install.sh
#
# Re-run any time — it pulls latest, reinstalls deps, restarts.
#
# Big files (>50 MB) over Telegram: put TELEGRAM_API_ID / TELEGRAM_API_HASH
# (from https://my.telegram.org) in .env before running and this script also
# builds a local telegram-bot-api server (127.0.0.1:8081) → 2 GB uploads.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mediadl}"
APP_USER="${APP_USER:-mediadl}"
NODE_MAJOR=20

[[ $EUID -eq 0 ]] || { echo "run as root: sudo bash install.sh"; exit 1; }
[[ -f "$APP_DIR/package.json" ]] || { echo "clone the repo to $APP_DIR first"; exit 1; }

echo "▶ packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git xxd ffmpeg aria2 \
  python3 python3-venv python3-pip ufw

if ! command -v node >/dev/null || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  echo "▶ node $NODE_MAJOR"
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq && apt-get install -y -qq nodejs
fi

echo "▶ user + perms"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR/telegram-bot/data"
git config --global --add safe.directory "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
# RAM-backed staging area (/run is tmpfs); recreated on every boot
echo "d /run/mediadl 0750 $APP_USER $APP_USER -" > /etc/tmpfiles.d/mediadl.conf
systemd-tmpfiles --create /etc/tmpfiles.d/mediadl.conf

echo "▶ pull latest"
sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only 2>/dev/null || echo "  (skipped — not a fast-forward)"

echo "▶ dependencies"
as_app() { sudo -u "$APP_USER" bash -c "cd '$1' && ${*:2}"; }
as_app "$APP_DIR"              "npm ci --no-audit --no-fund || npm install --no-audit --no-fund"
as_app "$APP_DIR/backend"      "npm ci --no-audit --no-fund || npm install --no-audit --no-fund"
as_app "$APP_DIR/telegram-bot" "npm ci --no-audit --no-fund || npm install --no-audit --no-fund"
as_app "$APP_DIR" "python3 -m venv .venv && ./.venv/bin/pip -q install --upgrade pip && \
  ./.venv/bin/pip -q install -r python-service/requirements.txt && \
  ./.venv/bin/python -m playwright install chromium"
# chromium's shared-lib deps need root
"$APP_DIR/.venv/bin/python" -m playwright install-deps chromium || \
  apt-get install -y -qq libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2t64 2>/dev/null || true

echo "▶ .env"
if [[ ! -f "$APP_DIR/.env" ]]; then
  KEY=$(head -c24 /dev/urandom | xxd -p | tr -d '\n')
  cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=4000
PYTHON_SERVICE_URL=http://127.0.0.1:8000
WORKER_CONCURRENCY=3
MAX_CONCURRENT_DOWNLOADS=5
VERIFY_SSL=true
DOWNLOAD_DIR=/run/mediadl
DOWNLOAD_GRACE_SECONDS=120

# ── Telegram bot ───────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USERS=
# TELEGRAM_ADMINS=
TELEGRAM_DELIVERY=upload
TELEGRAM_MAX_UPLOAD_MB=49

# server-to-server key so the bot skips Turnstile
INTERNAL_API_KEY=$KEY
TURNSTILE_SECRET_KEY=

# ── OPTIONAL: local Bot API server for 2 GB uploads ────────────
# get these from https://my.telegram.org, then re-run install.sh
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
EOF
  chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"; chmod 600 "$APP_DIR/.env"
  echo "  → set TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_USERS in $APP_DIR/.env, then re-run."
fi
set -a; source "$APP_DIR/.env"; set +a

# ── optional: local telegram-bot-api (2 GB uploads) ──────────────────────────
if [[ -n "${TELEGRAM_API_ID:-}" && -n "${TELEGRAM_API_HASH:-}" && ! -x /usr/local/bin/telegram-bot-api ]]; then
  echo "▶ building telegram-bot-api (~15 min)…"
  apt-get install -y -qq cmake g++ make git zlib1g-dev libssl-dev gperf
  tmp=$(mktemp -d); git clone --recursive -q https://github.com/tdlib/telegram-bot-api.git "$tmp"
  cmake -S "$tmp" -B "$tmp/build" -DCMAKE_BUILD_TYPE=Release >/dev/null
  cmake --build "$tmp/build" -j"$(nproc)" >/dev/null
  install -m755 "$tmp/build/telegram-bot-api" /usr/local/bin/; rm -rf "$tmp"
  cat > /etc/systemd/system/telegram-bot-api.service <<EOF
[Unit]
Description=Local Telegram Bot API server
After=network-online.target
[Service]
User=$APP_USER
RuntimeDirectory=tg-bot-api
ExecStart=/usr/local/bin/telegram-bot-api --local --api-id=$TELEGRAM_API_ID --api-hash=$TELEGRAM_API_HASH --http-ip-address=127.0.0.1 --http-port=8081 --dir=/run/tg-bot-api
Restart=always
[Install]
WantedBy=multi-user.target
EOF
  systemctl enable --now telegram-bot-api
  grep -q '^TELEGRAM_API_ROOT=' "$APP_DIR/.env" || echo 'TELEGRAM_API_ROOT=http://127.0.0.1:8081' >> "$APP_DIR/.env"
  sed -i 's/^TELEGRAM_DELIVERY=.*/TELEGRAM_DELIVERY=auto/' "$APP_DIR/.env"
fi

echo "▶ systemd units"
for u in py api bot; do
  sed "s#@APP_DIR@#$APP_DIR#g; s#@APP_USER@#$APP_USER#g" \
    "$APP_DIR/deploy/mediadl-$u.service" > "/etc/systemd/system/mediadl-$u.service"
done
systemctl daemon-reload
systemctl enable --now mediadl-py mediadl-api mediadl-bot
systemctl restart mediadl-py mediadl-api mediadl-bot

echo "▶ firewall — SSH only"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null

sleep 2
echo
echo "✅ deployed."
systemctl is-active mediadl-py mediadl-api mediadl-bot | paste <(printf 'py\napi\nbot\n') -
echo
curl -sf localhost:4000/health && echo || echo "backend not answering yet — check: journalctl -u mediadl-api -n50"
echo "bot log:  journalctl -u mediadl-bot -f"
