#!/usr/bin/env bash
# Extract the current trycloudflare URL from the tunnel log and publish it
# to the state file the Mac kiosk/redirect reads over SSH.
# Handles both the Cortex app tunnel and the Bark push tunnel.
set -u
DIR=/home/ubuntu/cortex-oracle
WLOG=$DIR/watchdog.log
mkdir -p "$DIR"

publish() {
  local LOG=$1 OUT=$2 NAME=$3
  local URL
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | tail -1)
  [ -z "$URL" ] && return 0
  local CUR
  CUR=$(cat "$OUT" 2>/dev/null || true)
  if [ "$URL" != "$CUR" ]; then
    echo "$URL" > "$OUT"
    echo "$(date -Is) $NAME -> $URL" >> "$WLOG"
  fi
}

publish "$DIR/tunnel.log" "$DIR/tunnel-url" cortex
publish "$DIR/bark-tunnel.log" "$DIR/bark-url" bark
publish "$DIR/voice-tunnel.log" "$DIR/voice-url" voice
