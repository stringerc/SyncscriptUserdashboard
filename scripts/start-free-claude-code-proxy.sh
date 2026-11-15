#!/usr/bin/env bash
# Restart free-claude-code proxy on 127.0.0.1:8082 with a clean process env.
# Stale exported MODEL* from an old `source .env` override pydantic/dotenv — always unset them here.
#
# Ownership rule (why this matters): when the launchd agent
# com.syncscript.free-claude-code is loaded it owns :8082 with KeepAlive=true.
# Spawning a rival `nohup` process here produced two real outages:
#   1. killing launchd's worker → KeepAlive respawn races the new process →
#      "[Errno 48] address already in use" crash loop, and
#   2. the nohup child is reaped when its shell/session ends → nothing listening →
#      "ConnectionRefused" in the Devin / Cursor / Antigravity Claude extensions.
# So: if the agent is loaded, delegate to launchctl kickstart. Only fall back to a
# detached process when no agent exists.
#
# Usage (from SyncScript repo root):
#   bash scripts/start-free-claude-code-proxy.sh
#   FCC_FORCE_FOREGROUND=1 bash scripts/start-free-claude-code-proxy.sh   # bypass launchd

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/fcc-proxy-defaults.sh
source "${SCRIPT_DIR}/fcc-proxy-defaults.sh"

FCC_DIR="${FCC_DIR:-${HOME}/src/free-claude-code}"
PORT="${FCC_PROXY_PORT}"
LOG="${FCC_PROXY_LOG:-/tmp/free-claude-code-proxy.log}"
LAUNCHD_LABEL="${FCC_LAUNCHD_LABEL:-com.syncscript.free-claude-code}"
LAUNCHD_PLIST="${HOME}/Library/LaunchAgents/${LAUNCHD_LABEL}.plist"
DOMAIN="gui/$(id -u)"

if [[ ! -d "$FCC_DIR" ]]; then
  echo "FAIL: free-claude-code not found at $FCC_DIR" >&2
  exit 1
fi

wait_for_listener() {
  for _ in $(seq 1 20); do
    sleep 1
    if lsof -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

# --- Preferred path: launchd owns the proxy (survives shell exit + reboot) ---
if [[ -f "$LAUNCHD_PLIST" && "${FCC_FORCE_FOREGROUND:-0}" != "1" ]]; then
  if ! launchctl print "${DOMAIN}/${LAUNCHD_LABEL}" >/dev/null 2>&1; then
    echo "launchd agent not loaded — bootstrapping ${LAUNCHD_LABEL}"
    launchctl bootstrap "$DOMAIN" "$LAUNCHD_PLIST" 2>/dev/null || true
    launchctl enable "${DOMAIN}/${LAUNCHD_LABEL}" 2>/dev/null || true
  fi
  echo "Restarting via launchd (${LAUNCHD_LABEL})"
  launchctl kickstart -k "${DOMAIN}/${LAUNCHD_LABEL}" >/dev/null 2>&1 || true

  if wait_for_listener; then
    echo "OK: listening on ${FCC_PROXY_HOST}:${PORT} (owner: launchd, KeepAlive=true)"
    launchctl print "${DOMAIN}/${LAUNCHD_LABEL}" 2>/dev/null | grep -E '^[[:space:]]*(state|pid) =' || true
    exit 0
  fi

  echo "FAIL: launchd agent did not bind :${PORT}. Last launchd stderr:" >&2
  tail -20 "${FCC_DIR}/launchd-stderr.log" 2>/dev/null >&2 || true
  echo "Hint: FCC_FORCE_FOREGROUND=1 bash scripts/start-free-claude-code-proxy.sh" >&2
  exit 1
fi

# --- Fallback: no launchd agent. Detach fully so the shell exiting cannot reap it. ---
pid="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -1 || true)"
if [[ -n "$pid" ]]; then
  echo "Stopping proxy on :${PORT} (PID ${pid})"
  kill "$pid" 2>/dev/null || true
  sleep 2
  if lsof -tiTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    kill -9 "$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN | head -1)" 2>/dev/null || true
    sleep 1
  fi
fi

cd "$FCC_DIR"
UV_BIN="${FCC_UV_BIN:-${HOME}/Library/Python/3.9/bin/uv}"
[[ -x "$UV_BIN" ]] || UV_BIN="$(command -v uv || echo "$UV_BIN")"

setsid_cmd=()
command -v setsid >/dev/null 2>&1 && setsid_cmd=(setsid)

nohup "${setsid_cmd[@]}" env -u MODEL -u MODEL_OPUS -u MODEL_SONNET -u MODEL_HAIKU \
  UV_PYTHON=python3.13 "$UV_BIN" run uvicorn server:app \
  --host "${FCC_PROXY_HOST}" --port "${PORT}" >"$LOG" 2>&1 &
disown 2>/dev/null || true
echo "Started detached proxy (log: ${LOG})"
echo "NOTE: no launchd agent at ${LAUNCHD_PLIST} — this process will not survive reboot."

if wait_for_listener; then
  echo "OK: listening on ${FCC_PROXY_HOST}:${PORT}"
  tail -3 "$LOG" 2>/dev/null || true
  exit 0
fi

echo "FAIL: proxy did not bind to :${PORT}. Last log lines:" >&2
tail -20 "$LOG" >&2 || true
exit 1
