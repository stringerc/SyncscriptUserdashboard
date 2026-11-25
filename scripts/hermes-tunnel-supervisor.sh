#!/usr/bin/env bash
# Hermes quick-tunnel supervisor — keeps a cloudflared tunnel to :18880 alive
# and republishes the ephemeral URL to the Edge bridge whenever it changes.
#
# Env (via systemd EnvironmentFile=/etc/hermes-tunnel.env):
#   HERMES_TUNNEL_SECRET   — shared secret for POST /hermes/tunnel-url
#   HERMES_EDGE_BASE       — e.g. https://<ref>.supabase.co/functions/v1/make-server-57781ad9
#   HERMES_TUNNEL_PORT     — local executor port (default 18880)
set -uo pipefail

PORT="${HERMES_TUNNEL_PORT:-18880}"
EDGE="${HERMES_EDGE_BASE%/}"
LOG="${HERMES_TUNNEL_LOG:-/var/log/hermes-tunnel.log}"
LAST_URL=""

publish() {
  local url="$1"
  [ "$url" = "$LAST_URL" ] && return 0
  local resp
  resp=$(curl -sS --max-time 15 -X POST "${EDGE}/hermes/tunnel-url" \
    -H "Content-Type: application/json" \
    -H "X-Hermes-Tunnel-Secret: ${HERMES_TUNNEL_SECRET}" \
    -d "{\"url\":\"${url}\"}" 2>&1) || true
  if echo "$resp" | grep -q '"ok":true'; then
    echo "[$(date -Is)] published tunnel URL: $url" >>"$LOG"
    LAST_URL="$url"
  else
    echo "[$(date -Is)] publish FAILED for $url: $resp" >>"$LOG"
  fi
}

echo "[$(date -Is)] hermes-tunnel supervisor starting (port $PORT)" >>"$LOG"

while true; do
  # Run cloudflared in foreground-ish; capture its output to parse the URL.
  OUT=$(mktemp)
  cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${PORT}" >"$OUT" 2>&1 &
  CF_PID=$!

  # Watch output for the trycloudflare URL (appears within ~10s normally).
  for _ in $(seq 1 60); do
    URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$OUT" | head -1 || true)
    if [ -n "$URL" ]; then
      publish "$URL"
      break
    fi
    if ! kill -0 "$CF_PID" 2>/dev/null; then break; fi
    sleep 1
  done

  # Keep supervising: if cloudflared exits, loop restarts it and republishes.
  while kill -0 "$CF_PID" 2>/dev/null; do
    sleep 5
    # Re-scan in case URL line arrived late or rotated.
    URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$OUT" | head -1 || true)
    [ -n "$URL" ] && publish "$URL"
  done
  wait "$CF_PID" 2>/dev/null || true
  echo "[$(date -Is)] cloudflared exited (pid $CF_PID); restarting in 5s" >>"$LOG"
  tail -5 "$OUT" >>"$LOG" 2>/dev/null || true
  rm -f "$OUT"
  sleep 5
done
