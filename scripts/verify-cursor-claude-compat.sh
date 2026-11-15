#!/usr/bin/env bash
# Verify Cursor Claude Code proxy path: settings + proxy on canonical port.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/fcc-proxy-defaults.sh
source "${SCRIPT_DIR}/fcc-proxy-defaults.sh"
PORT="${FCC_PROXY_PORT}"
CURSOR_SETTINGS="${CURSOR_SETTINGS:-${HOME}/Library/Application Support/Cursor/User/settings.json}"
FAIL=0

ok() { echo "OK:   $*"; }
fail() { echo "FAIL: $*" >&2; FAIL=1; }
warn() { echo "WARN: $*" >&2; }

echo "== Cursor Claude compat verify =="

if [[ ! -f "$CURSOR_SETTINGS" ]]; then
  fail "missing $CURSOR_SETTINGS"
else
  ok "Cursor settings.json exists"
  export CURSOR_SETTINGS PORT
  if python3 - <<'PY'
import json, os, sys
p = os.environ["CURSOR_SETTINGS"]
port = os.environ["PORT"]
data = json.load(open(p))
env = {e["name"]: e.get("value") for e in data.get("claudeCode.environmentVariables", []) if isinstance(e, dict)}
want_url = f"http://127.0.0.1:{port}"
ok = True
if env.get("ANTHROPIC_BASE_URL") != want_url:
    print(f"ANTHROPIC_BASE_URL={env.get('ANTHROPIC_BASE_URL')!r} want {want_url!r}")
    ok = False
for k, v in {
    "CLAUDE_CODE_DISABLE_THINKING": "0",
    "MAX_THINKING_TOKENS": "16000",
    "DISABLE_INTERLEAVED_THINKING": "0",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "0",
}.items():
    if env.get(k) != v:
        print(f"{k}={env.get(k)!r} want {v!r}")
        ok = False
sys.exit(0 if ok else 1)
PY
  then
    ok "Cursor proxy env aligned (:${PORT})"
  else
    fail "Cursor settings incomplete — bash scripts/apply-cursor-claude-proxy-settings.sh"
  fi
fi

if ! lsof -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  warn "proxy down — starting"
  bash "${SCRIPT_DIR}/start-free-claude-code-proxy.sh" || fail "proxy start failed"
fi
ok "proxy :${PORT} listening"

echo ""
if [[ "$FAIL" -ne 0 ]]; then
  echo "Summary: FAILED"
  exit 1
fi
echo "Summary: PASSED — Cmd+Q Cursor → reopen → NEW Claude chat → Reply with exactly: OK"
exit 0
