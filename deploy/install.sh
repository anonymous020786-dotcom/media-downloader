#!/usr/bin/env bash
# MediaDL — bot-only install (Ubuntu 22.04 / 24.04 / 26.04).
#
#   Runs python-service (127.0.0.1:8000) + backend (127.0.0.1:4000) + the
#   Telegram bot, as systemd services. NO web UI.
#
# SAFE ON A SHARED BOX: strictly additive. It does NOT touch the firewall,
# does NOT replace an existing Node, and everything it creates is namespaced
# (mediadl user, mediadl-* units, /opt/mediadl, /run/mediadl). Lock the box
# down separately with ./firewall.sh once you've checked what else runs here.
#
# Usage (as root):
#   git clone https://TOKEN@github.com/anonymous020786-dotcom/media-downloader.git /opt/mediadl
#   cd /opt/mediadl/deploy && bash install.sh
#   nano /opt/mediadl/.env      # TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_USERS
#   bash install.sh             # again
#
# Re-run any time — pulls latest, reinstalls deps, restarts.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mediadl}"
APP_USER="${APP_USER:-mediadl}"

[[ $EUID -eq 0 ]] || { echo "run as root: sudo bash install.sh"; exit 1; }
[[ -f "$APP_DIR/package.json" ]] || { echo "clone the repo to $APP_DIR first"; exit 1; }

# ── ports: refuse to clobber something already listening ─────────────────────
# (A port held by our own unit is fine — that's a re-run/upgrade, which
#  restarts those units further down.)
for pu in 8000:mediadl-py 4000:mediadl-api; do
  p=${pu%%:*}; unit=${pu#*:}
  pid=$(ss -ltnpH "sport = :$p" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)
  [[ -z "$pid" ]] && continue
  grep -q "/$unit.service" "/proc/$pid/cgroup" 2>/dev/null && continue
  echo "✗ port $p is already in use on this host — set PORT / PYTHON_SERVICE_URL"
  echo "  in $APP_DIR/.env to free ports and re-run, or stop that service."
  exit 1
done

echo "▶ packages (additive only)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git xxd ffmpeg aria2 \
  python3 python3-venv python3-pip iproute2

# Node: use whatever is here if it's >= 18. Only install (v20, isolated repo)
# when there is no node at all. Never replace an existing one.
NODE_OK=0
if command -v node >/dev/null; then
  NV=$(node -v | sed 's/v//;s/\..*//')
  if [[ "$NV" -ge 18 ]]; then NODE_OK=1; echo "  using existing Node $(node -v)"
  else echo "✗ Node $(node -v) is too old and I won't upgrade it on a shared box.
  Install Node >=18 yourself (e.g. via nvm for the $APP_USER user) and re-run."; exit 1
  fi
fi
if [[ "$NODE_OK" -eq 0 ]]; then
  echo "  installing Node 20"
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq && apt-get install -y -qq nodejs
fi

echo "▶ user + perms"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR/telegram-bot/data"
git config --global --add safe.directory "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
echo "d /run/mediadl 0750 $APP_USER $APP_USER -" > /etc/tmpfiles.d/mediadl.conf
systemd-tmpfiles --create /etc/tmpfiles.d/mediadl.conf

echo "▶ pull latest"
sudo -u "$APP_USER" ${GIT_SSH_COMMAND:+env GIT_SSH_COMMAND="$GIT_SSH_COMMAND"} \
  git -C "$APP_DIR" pull --ff-only 2>/dev/null || echo "  (skipped)"

echo "▶ dependencies"
as_app() { sudo -u "$APP_USER" bash -c "cd '$1' && ${*:2}"; }
as_app "$APP_DIR"              "npm ci --no-audit --no-fund || npm install --no-audit --no-fund"
as_app "$APP_DIR/backend"      "npm ci --no-audit --no-fund || npm install --no-audit --no-fund"
as_app "$APP_DIR/telegram-bot" "npm ci --no-audit --no-fund || npm install --no-audit --no-fund"
as_app "$APP_DIR" "python3 -m venv .venv && ./.venv/bin/pip -q install --upgrade pip && \
  ./.venv/bin/pip -q install --upgrade -r python-service/requirements.txt && \
  ./.venv/bin/python -m playwright install chromium"
"$APP_DIR/.venv/bin/python" -m playwright install-deps chromium 2>/dev/null || \
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

INTERNAL_API_KEY=$KEY
TURNSTILE_SECRET_KEY=

# ── OPTIONAL: local Bot API server for 2 GB uploads ────────────
# get from https://my.telegram.org, then re-run install.sh
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
EOF
  chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"; chmod 600 "$APP_DIR/.env"
  echo
  echo "  ⚠  Set TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_USERS in $APP_DIR/.env, then re-run."
  echo
fi
set -a; source "$APP_DIR/.env"; set +a

# ── optional: local telegram-bot-api (2 GB uploads) ──────────────────────────
if [[ -n "${TELEGRAM_API_ID:-}" && -n "${TELEGRAM_API_HASH:-}" && ! -x /usr/local/bin/telegram-bot-api ]]; then
  echo "▶ building telegram-bot-api (~15 min)…"
  apt-get install -y -qq cmake g++ make zlib1g-dev libssl-dev gperf
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

echo "▶ systemd units (mediadl-* only)"
for u in py api bot; do
  sed "s#@APP_DIR@#$APP_DIR#g; s#@APP_USER@#$APP_USER#g" \
    "$APP_DIR/deploy/mediadl-$u.service" > "/etc/systemd/system/mediadl-$u.service"
done
systemctl daemon-reload
systemctl enable --now mediadl-py mediadl-api mediadl-bot
systemctl restart mediadl-py mediadl-api mediadl-bot

sleep 2
echo
echo "✅ services installed (bound to 127.0.0.1 only):"
systemctl is-active mediadl-py mediadl-api mediadl-bot | paste <(printf 'py\napi\nbot\n') -
curl -sf localhost:4000/health >/dev/null && echo "   backend health: ok" || echo "   backend: check journalctl -u mediadl-api -n50"
echo
echo "The firewall was NOT touched. To lock this box to SSH-only:  bash firewall.sh"
echo "Bot log:  journalctl -u mediadl-bot -f"
