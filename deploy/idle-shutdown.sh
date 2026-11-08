#!/usr/bin/env bash
# Stops this EC2 instance after a stretch of no activity, to save cost on a box
# that's mostly idle between Telegram messages. Runs every 10 min
# (mediadl-idle.timer); stops after IDLE_CHECKS_BEFORE_STOP idle checks in a row.
#
# A check counts as BUSY (counter reset to 0) if any of these is true:
#   1. a deploy is running (deploy/install.sh) — never stop mid-install
#   2. the job queue has active/waiting downloads
#   3. the API saw a real request in the last ACTIVITY_WINDOW seconds
#      (backend reports idleSeconds; the bot calls the API for everything)
#   4. the bot logged anything in that window — e.g. uploading a finished
#      file to Telegram, which happens after the job leaves the queue
# If the backend can't be reached we don't guess: no change, no stop.
#
# `shutdown -h now` is an EC2 "stop" (InstanceInitiatedShutdownBehavior=stop),
# so the disk and services survive; a deploy or `aws ec2 start-instances`
# brings it back.
set -euo pipefail

STATE_FILE=/run/mediadl/idle-count
IDLE_CHECKS_BEFORE_STOP="${IDLE_CHECKS_BEFORE_STOP:-6}"  # 6 * 10min = 60min idle
ACTIVITY_WINDOW="${IDLE_ACTIVITY_WINDOW_SECONDS:-660}"   # one check interval + margin

mkdir -p /run/mediadl

busy() {
  echo 0 > "$STATE_FILE"
  echo "busy: $1"
  exit 0
}

# 1. deploy in progress
pgrep -f '(^|[ /])install\.sh( |$)' >/dev/null && busy "deploy in progress"

stats=$(curl -sf --max-time 10 'http://127.0.0.1:4000/api/jobs/stats?probe=idle' 2>/dev/null) || stats=""
if [[ -z "$stats" ]]; then
  echo "backend unreachable — not counting"
  exit 0
fi
num() { echo "$stats" | grep -o "\"$1\":[0-9]*" | grep -o '[0-9]*$' || true; }
active=$(num active);  active=${active:-0}
waiting=$(num waiting); waiting=${waiting:-0}
idle_s=$(num idleSeconds)   # empty on an older backend → signal skipped

# 2. downloads queued/running
(( active > 0 || waiting > 0 )) && busy "jobs active=$active waiting=$waiting"

# 3. recent API use
[[ -n "$idle_s" ]] && (( idle_s < ACTIVITY_WINDOW )) && busy "API used ${idle_s}s ago"

# 4. recent bot output (uploads, errors, restarts)
if journalctl -u mediadl-bot --since "-${ACTIVITY_WINDOW}s" -o cat -q --no-pager 2>/dev/null | grep -q .; then
  busy "bot activity in last ${ACTIVITY_WINDOW}s"
fi

count=$(( $(cat "$STATE_FILE" 2>/dev/null || echo 0) + 1 ))
echo "$count" > "$STATE_FILE"
echo "idle check $count/$IDLE_CHECKS_BEFORE_STOP"
if (( count >= IDLE_CHECKS_BEFORE_STOP )); then
  logger -t mediadl-idle "idle for $((IDLE_CHECKS_BEFORE_STOP * 10))min (no jobs, API or bot activity) — stopping instance to save cost"
  shutdown -h now
fi
