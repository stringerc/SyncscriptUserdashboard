#!/usr/bin/env bash
# Verify Devin.app Claude Code / ACP proxy path: settings + listening free-claude-code.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/fcc-proxy-defaults.sh
source "${SCRIPT_DIR}/fcc-proxy-defaults.sh"
PORT="${FCC_PROXY_PORT}"
DEVIN_SETTINGS="${DEVIN_SETTINGS:-${HOME}/Library/Application Support/Devin/User/settings.json}"
FAIL=0

ok() { echo "OK:   $*"; }
fail() { echo "FAIL: $*" >&2; FAIL=1; }
warn() { echo "WARN: $*" >&2; }

echo "== Devin Claude / ACP compat verify =="

if [[ ! -f "$DEVIN_SETTINGS" ]]; then
  fail "missing $DEVIN_SETTINGS (is Devin.app installed?)"
else
  ok "Devin settings.json exists"
  export DEVIN_SETTINGS PORT
  if python3 - <<'PY'
import json, os, sys
p = os.environ["DEVIN_SETTINGS"]
port = os.environ["PORT"]
data = json.load(open(p))
env = {
    e["name"]: e.get("value")
    for e in data.get("claudeCode.environmentVariables", [])
    if isinstance(e, dict) and "name" in e
}
want_url = f"http://127.0.0.1:{port}"
ok_flag = True
if env.get("ANTHROPIC_BASE_URL") != want_url:
    print(f"ANTHROPIC_BASE_URL={env.get('ANTHROPIC_BASE_URL')!r} want {want_url!r}")
    ok_flag = False
if not env.get("ANTHROPIC_AUTH_TOKEN"):
    print("ANTHROPIC_AUTH_TOKEN missing")
    ok_flag = False
# Thinking ON — reasoning models need budgeted thinking (not the old disable defaults).
for k, v in {
    "CLAUDE_CODE_DISABLE_THINKING": "0",
    "DISABLE_INTERLEAVED_THINKING": "0",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "0",
}.items():
    if env.get(k) != v:
        print(f"{k}={env.get(k)!r} want {v!r}")
        ok_flag = False
try:
    max_think = int(env.get("MAX_THINKING_TOKENS") or "0")
except ValueError:
    max_think = 0
if max_think < 1000:
    print(f"MAX_THINKING_TOKENS={env.get('MAX_THINKING_TOKENS')!r} want >= 1000 (thinking on)")
    ok_flag = False
# ACP preference (when present)
pref = data.get("devin.acp.preferredAgent")
if pref is not None and pref != "claude-code":
    print(f"devin.acp.preferredAgent={pref!r} want 'claude-code'")
    ok_flag = False
enabled = data.get("devin.acp.enabledAgents") or {}
if isinstance(enabled, dict) and enabled.get("claude-code") is False:
    print("devin.acp.enabledAgents.claude-code is false")
    ok_flag = False
sys.exit(0 if ok_flag else 1)
PY
  then
    ok "Devin proxy env + ACP claude-code aligned (:${PORT})"
  else
    fail "Devin settings incomplete — bash scripts/apply-devin-claude-proxy-settings.sh"
  fi
fi

if ! lsof -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  warn "proxy down — starting"
  bash "${SCRIPT_DIR}/start-free-claude-code-proxy.sh" || fail "proxy start failed"
fi
if lsof -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  ok "proxy :${PORT} listening"
else
  fail "proxy not listening on :${PORT}"
fi

# Agent-shaped request (Devin ACP / Claude panel may always send tools).
#
# Substring matching used to decide this and it was wrong in the worst direction: the proxy
# delivers its own failure text as a `text_delta`, so grepping for `text_delta` reported
# "returns model text" while the stream actually carried "Provider rate limit reached" and no
# answer at all (observed 2026-08-04). Assert stream *structure* instead, in one place.
#
# Exactly one upstream request per run: on a free tier every probe — including a failed one —
# spends daily quota, so this must not fire a second throwaway call.
if node "${SCRIPT_DIR}/verify-fcc-proxy-stream.mjs" --timeout 90; then
  ok "beta+tools stream is well-formed (message_start + real content + message_stop)"
else
  fail "beta+tools stream is not a real answer — see the classification above"
fi

echo ""
if [[ "$FAIL" -ne 0 ]]; then
  echo "Summary: FAILED"
  exit 1
fi
echo "Summary: PASSED — Cmd+Q Devin → reopen → NEW Claude/ACP chat → Reply with exactly: OK"
exit 0
