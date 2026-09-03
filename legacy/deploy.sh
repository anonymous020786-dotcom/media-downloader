#!/usr/bin/env bash
# MediaDL — Hostinger VPS deploy script
# Usage:  ./scripts/deploy.sh yourdomain.com
# Prereqs on VPS:  apt install -y docker.io docker-compose-plugin git certbot
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain>   e.g.  $0 mediadl.example.com"
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"

echo "▶ Domain : $DOMAIN"
echo "▶ Repo   : $REPO_DIR"

# ── 1. Check .env ──────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found.  Copy .env.example → .env and fill in real values."
  exit 1
fi

# Inject DOMAIN into the environment so docker-compose.prod.yml expands ${DOMAIN}
export DOMAIN

# ── 2. Patch nginx.prod.conf with the real domain ─────────────────────────────
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$REPO_DIR/nginx/nginx.prod.conf"
echo "✓ nginx.prod.conf patched"

# ── 3. Obtain SSL cert (skip if already exists) ───────────────────────────────
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [[ ! -f "$CERT_PATH" ]]; then
  echo "▶ Obtaining Let's Encrypt certificate for $DOMAIN …"
  # Spin up a temporary nginx on port 80 for the ACME challenge
  docker compose -f "$REPO_DIR/docker-compose.yml" \
                 -f "$REPO_DIR/docker-compose.prod.yml" \
    --env-file "$ENV_FILE" up -d nginx

  certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "admin@$DOMAIN"

  echo "✓ Certificate obtained"
else
  echo "✓ Certificate already exists, skipping certbot"
fi

# ── 4. Pull latest images / rebuild ───────────────────────────────────────────
echo "▶ Building images …"
docker compose -f "$REPO_DIR/docker-compose.yml" \
               -f "$REPO_DIR/docker-compose.prod.yml" \
  --env-file "$ENV_FILE" \
  build --no-cache frontend backend python-service

# ── 5. Start / restart all services ───────────────────────────────────────────
echo "▶ Starting services …"
docker compose -f "$REPO_DIR/docker-compose.yml" \
               -f "$REPO_DIR/docker-compose.prod.yml" \
  --env-file "$ENV_FILE" \
  up -d --remove-orphans

# ── 6. Smoke test ─────────────────────────────────────────────────────────────
echo "▶ Waiting 10s for services to stabilize …"
sleep 10

HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" || true)
if [[ "$HTTP_CODE" == "200" ]]; then
  echo "✅ Deploy successful — https://$DOMAIN is live (HTTP $HTTP_CODE)"
else
  echo "⚠  Health check returned HTTP $HTTP_CODE — check logs:"
  echo "   docker compose logs --tail 50 backend"
fi

# ── 7. Install daily cron for cert renewal ────────────────────────────────────
CRON_JOB="0 3 * * * docker compose -f $REPO_DIR/docker-compose.yml -f $REPO_DIR/docker-compose.prod.yml --env-file $ENV_FILE restart certbot 2>&1 | logger -t mediadl-certbot"
( crontab -l 2>/dev/null | grep -qF "mediadl-certbot" ) || (
  ( crontab -l 2>/dev/null; echo "$CRON_JOB" ) | crontab -
  echo "✓ Cert-renewal cron added (daily at 03:00)"
)

# ── 8. Install daily downloads cleanup cron ───────────────────────────────────
CLEANUP_JOB="30 3 * * * docker exec media-downloader-python-service-1 find /downloads -mindepth 2 -mtime +7 -delete 2>&1 | logger -t mediadl-cleanup"
( crontab -l 2>/dev/null | grep -qF "mediadl-cleanup" ) || (
  ( crontab -l 2>/dev/null; echo "$CLEANUP_JOB" ) | crontab -
  echo "✓ Downloads cleanup cron added (daily at 03:30, removes files >7 days)"
)

echo ""
echo "Done. Your stack:"
echo "  https://$DOMAIN          ← frontend"
echo "  https://$DOMAIN/api/     ← backend API"
echo "  https://$DOMAIN/health   ← health check"
