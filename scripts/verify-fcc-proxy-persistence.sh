#!/usr/bin/env bash
# Verify the free-claude-code proxy is OWNED BY LAUNCHD, not by a stray shell child.
#
# Why this gate exists (2026-08-04 outage):
#   Devin / Cursor / Antigravity Claude extensions reported
#     "API Error: Unable to connect to API (ConnectionRefused)"
#   because nothing was listening on :8082. Root cause was ownership, not code:
#     * the launchd agent had been booted out during troubleshooting, and
#     * scripts/start-free-claude-code-proxy.sh spawned a `nohup` child bound to the
#       calling shell's session, which the OS reaped when that session ended.
#   A plain "is the port up?" check passes right up until the shell exits, so it
#   cannot catch this. This script checks the OWNER and the RESTART CONTRACT.
#
# Usage:
#   bash scripts/verify-fcc-proxy-persistence.sh              # non-destructive checks
#   bash scripts/verify-fcc-proxy-persistence.sh --restart-proof   # also kill -9 + prove respawn
#
# Exit 0 = persistent. Exit 1 = will not survive a shell exit or reboot.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/fcc-proxy-defaults.sh
source "${SCRIPT_DIR}/fcc-proxy-defaults.sh"

LABEL="${FCC_LAUNCHD_LABEL:-com.syncscript.free-claude-code}"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
DOMAIN="gui/$(id -u)"
PORT="${FCC_PROXY_PORT}"
RESTART_PROOF=0
[[ "${1:-}" == "--restart-proof" ]] && RESTART_PROOF=1

FAILED=0
pass() { printf 'OK:   %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1"; FAILED=1; }
warn() { printf 'WARN: %s\n' "$1"; }

echo "== free-claude-code proxy persistence verify =="
echo "label=${LABEL} port=${PORT}"
echo ""

# 1. plist present
if [[ -f "$PLIST" ]]; then
  pass "launchd plist present ($PLIST)"
else
  fail "launchd plist MISSING at $PLIST — proxy cannot survive reboot"
fi

# 2. agent loaded in the GUI domain
LAUNCHD_PID=""
if launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1; then
  pass "launchd agent loaded in ${DOMAIN}"
  LAUNCHD_STATE="$(launchctl print "${DOMAIN}/${LABEL}" 2>/dev/null | awk -F'= ' '/^[[:space:]]*state = /{print $2; exit}')"
  LAUNCHD_PID="$(launchctl print "${DOMAIN}/${LABEL}" 2>/dev/null | awk -F'= ' '/^[[:space:]]*pid = /{print $2; exit}')"
  if [[ "$LAUNCHD_STATE" == "running" ]]; then
    pass "launchd state=running (pid ${LAUNCHD_PID:-?})"
  else
    fail "launchd state=${LAUNCHD_STATE:-unknown} — agent loaded but not running"
  fi
else
  fail "launchd agent NOT loaded — nothing will restart the proxy. Fix: launchctl bootstrap ${DOMAIN} ${PLIST}"
fi

# 3. restart contract + port agreement inside the plist
if [[ -f "$PLIST" ]]; then
  plist_report="$(python3 - "$PLIST" "$PORT" <<'PY'
import plistlib, sys
from pathlib import Path
plist_path, want_port = sys.argv[1], sys.argv[2]
d = plistlib.loads(Path(plist_path).read_bytes())
print("keepalive", "yes" if d.get("KeepAlive") else "no")
print("runatload", "yes" if d.get("RunAtLoad") else "no")
args = [str(a) for a in (d.get("ProgramArguments") or [])]
port = ""
if "--port" in args:
    i = args.index("--port")
    if i + 1 < len(args):
        port = args[i + 1]
print("port", port or "unset")
print("portmatch", "yes" if port == want_port else "no")
PY
)"
  kv() { echo "$plist_report" | awk -v k="$1" '$1==k{print $2}'; }
  [[ "$(kv keepalive)" == "yes" ]] && pass "plist KeepAlive=true (auto-restart on crash)" \
    || fail "plist KeepAlive not set — a crash leaves IDEs with ConnectionRefused"
  [[ "$(kv runatload)" == "yes" ]] && pass "plist RunAtLoad=true (starts at login)" \
    || fail "plist RunAtLoad not set — proxy will not come back after reboot"
  [[ "$(kv portmatch)" == "yes" ]] && pass "plist port matches canonical :${PORT}" \
    || fail "plist port=$(kv port) but canonical is :${PORT} — run scripts/align-fcc-proxy-launchd.sh"
fi

# 4. something is actually listening
LISTENER_PID="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -1 || true)"
if [[ -n "$LISTENER_PID" ]]; then
  pass "listener present on ${FCC_PROXY_HOST}:${PORT} (pid ${LISTENER_PID})"
else
  fail "NOTHING listening on ${FCC_PROXY_HOST}:${PORT} — this is the exact ConnectionRefused state"
fi

# 5. ownership: the listener must descend from the launchd-managed process,
#    otherwise it is a shell child that dies with its session (split-brain).
if [[ -n "$LISTENER_PID" && -n "$LAUNCHD_PID" ]]; then
  ancestor=""
  probe="$LISTENER_PID"
  for _ in 1 2 3 4 5 6 7 8; do
    [[ -z "$probe" || "$probe" == "0" || "$probe" == "1" ]] && break
    if [[ "$probe" == "$LAUNCHD_PID" ]]; then ancestor="yes"; break; fi
    probe="$(ps -o ppid= -p "$probe" 2>/dev/null | tr -d ' ')"
  done
  if [[ "$ancestor" == "yes" ]]; then
    pass "listener is a descendant of the launchd agent (single owner, no split-brain)"
  else
    fail "listener pid ${LISTENER_PID} is NOT under launchd pid ${LAUNCHD_PID} — stray process will die with its shell. Fix: bash scripts/start-free-claude-code-proxy.sh"
  fi
elif [[ -n "$LISTENER_PID" ]]; then
  warn "cannot confirm ownership (launchd pid unknown) — listener may be a stray shell child"
fi

# 6. health endpoint answers
health_code="$(curl -sS -o /dev/null -m 5 -w '%{http_code}' "http://${FCC_PROXY_HOST}:${PORT}/health" 2>/dev/null || echo 000)"
if [[ "$health_code" == "200" ]]; then
  pass "GET /health → 200"
else
  fail "GET /health → ${health_code} (expected 200)"
fi

# 7. optional destructive proof that KeepAlive really works
if [[ "$RESTART_PROOF" == "1" && -n "$LISTENER_PID" ]]; then
  echo ""
  echo "-- restart proof: kill -9 ${LISTENER_PID}, expect launchd respawn --"
  kill -9 "$LISTENER_PID" 2>/dev/null || true
  respawned=""
  for _ in $(seq 1 20); do
    sleep 1
    new_pid="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -1 || true)"
    if [[ -n "$new_pid" && "$new_pid" != "$LISTENER_PID" ]]; then respawned="$new_pid"; break; fi
  done
  if [[ -n "$respawned" ]]; then
    pass "KeepAlive respawned listener (${LISTENER_PID} → ${respawned})"
    code="$(curl -sS -o /dev/null -m 5 -w '%{http_code}' "http://${FCC_PROXY_HOST}:${PORT}/health" 2>/dev/null || echo 000)"
    [[ "$code" == "200" ]] && pass "post-respawn /health → 200" || fail "post-respawn /health → ${code}"
  else
    fail "listener did NOT respawn within 20s — KeepAlive is not protecting the proxy"
  fi
fi

echo ""
if [[ "$FAILED" == "0" ]]; then
  echo "Summary: PASSED — proxy is launchd-owned and survives shell exit, crash, and reboot."
  exit 0
fi
echo "Summary: FAILED — proxy is not durably persistent. IDE Claude extensions will hit ConnectionRefused."
echo "Repair: bash scripts/start-free-claude-code-proxy.sh   (delegates to launchd)"
echo "        bash scripts/align-fcc-proxy-launchd.sh        (port drift / plist rewrite)"
exit 1
