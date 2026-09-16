#!/usr/bin/env bash
# Stops this EC2 instance after a stretch of no download activity, to save
# cost on a box that's mostly idle between Telegram messages. Safe: it only
# counts idle time when the backend reports zero waiting/active jobs, so a
# long-running download (even a slow, low-CPU one via aria2c) is never
# interrupted. `shutdown -h now` maps to an EC2 "stop" (not terminate) under
# the default InstanceInitiatedShutdownBehavior, so the EBS volume and all
# installed services survive — `aws ec2 start-instances` brings it right back.
set -euo pipefail

STATE_FILE=/run/mediadl/idle-count
IDLE_CHECKS_BEFORE_STOP="${IDLE_CHECKS_BEFORE_STOP:-6}"  # 6 * 10min = 60min idle

mkdir -p /run/mediadl

stats=$(curl -sf http://127.0.0.1:4000/api/jobs/stats 2>/dev/null) || stats=""
active=$(echo "$stats" | grep -o '"active":[0-9]*' | grep -o '[0-9]*' || true)
waiting=$(echo "$stats" | grep -o '"waiting":[0-9]*' | grep -o '[0-9]*' || true)
active=${active:-0}
waiting=${waiting:-0}

if [[ -z "$stats" ]]; then
  # backend unreachable — don't guess, don't stop
  exit 0
fi

if [[ "$active" -eq 0 && "$waiting" -eq 0 ]]; then
  count=$(($(cat "$STATE_FILE" 2>/dev/null || echo 0) + 1))
  echo "$count" > "$STATE_FILE"
  if [[ "$count" -ge "$IDLE_CHECKS_BEFORE_STOP" ]]; then
    logger -t mediadl-idle "no jobs for $((IDLE_CHECKS_BEFORE_STOP * 10))min — stopping instance to save cost"
    shutdown -h now
  fi
else
  echo 0 > "$STATE_FILE"
fi
