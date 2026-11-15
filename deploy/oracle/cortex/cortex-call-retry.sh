#!/usr/bin/env bash
# Retries a pending outbound call until Telnyx rate limits allow it.
# Pending request lives at ~/cortex-oracle/pending-call.json:
#   {"to":"+1...","greeting":"..."}
# On success the file is removed and result logged to call-retry.log.
set -u
DIR=/home/ubuntu/cortex-oracle
PENDING=$DIR/pending-call.json
LOG=$DIR/call-retry.log
[ -f "$PENDING" ] || exit 0
TO=$(python3 -c "import json;print(json.load(open('$PENDING'))['to'])" 2>/dev/null) || exit 0
GREET=$(python3 -c "import json;print(json.load(open('$PENDING')).get('greeting',''))" 2>/dev/null)
# Voice bridge HTTP API requires auth (public tunnel) — send the edge token.
set -a; [ -f /opt/cortex-app/.env.cortex ] && . /opt/cortex-app/.env.cortex; [ -f /opt/cortex-app/.env ] && . /opt/cortex-app/.env; set +a
RESP=$(curl -s -m 20 -X POST "http://127.0.0.1:8790/dial?tok=${VOICE_BRIDGE_TOKEN:-}" \
  -H 'Content-Type: application/json' \
  -H "x-cortex-key: ${CORTEX_EDGE_TOKEN:-}" \
  -d "{\"to\":\"$TO\",\"greeting\":\"$GREET\"}")
echo "$(date -Is) dial -> $RESP" >> "$LOG"
if echo "$RESP" | grep -q call_control_id; then
  mv "$PENDING" "$PENDING.done-$(date +%s)"
  echo "$(date -Is) CALL PLACED $TO" >> "$LOG"
fi
