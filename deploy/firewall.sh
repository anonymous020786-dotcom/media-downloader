#!/usr/bin/env bash
# Optional — run this ONLY if MediaDL is the only thing that should face the
# internet on this box. It denies all inbound except SSH (and any ports you
# pass). If you also run a website / mail / anything else here, DO NOT run this
# without adding their ports.
#
#   bash firewall.sh                 # SSH only
#   bash firewall.sh 80 443          # SSH + a web server
#   bash firewall.sh 25 465 587 993  # SSH + mail
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }

echo "Currently listening on public interfaces:"
ss -ltnH | awk '$4 !~ /127\.0\.0\.1|::1|\[::1\]/ {print "  " $4}' | sort -u
echo
read -rp "This will block all inbound except SSH${*:+ + ports: $*}. Continue? [y/N] " ok
[[ "${ok,,}" == y ]] || { echo "aborted."; exit 0; }

apt-get install -y -qq ufw
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
for port in "$@"; do ufw allow "$port"; done
ufw --force enable
echo
ufw status verbose
