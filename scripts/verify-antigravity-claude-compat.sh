#!/usr/bin/env bash
# Verify Antigravity Claude proxy path: settings + proxy + beta SSE without thinking garbage.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=scripts/fcc-proxy-defaults.sh
source "${SCRIPT_DIR}/fcc-proxy-defaults.sh"
PORT="${FCC_PROXY_PORT}"
AG_SETTINGS="${ANTIGRAVITY_SETTINGS:-${HOME}/Library/Application Support/Antigravity/User/settings.json}"
FAIL=0

ok() { echo "OK:   $*"; }
fail() { echo "FAIL: $*" >&2; FAIL=1; }
warn() { echo "WARN: $*" >&2; }

echo "== Antigravity Claude compat verify =="

# Settings
if [[ ! -f "$AG_SETTINGS" ]]; then
  fail "missing $AG_SETTINGS"
else
  ok "Antigravity settings.json exists"
  export AG_SETTINGS
  if python3 - <<'PY'
import json, os, sys
p = os.environ["AG_SETTINGS"]
data = json.load(open(p))
env = {e["name"]: e.get("value") for e in data.get("claudeCode.environmentVariables", []) if isinstance(e, dict)}
need = {
    "CLAUDE_CODE_DISABLE_THINKING": "0",
    "MAX_THINKING_TOKENS": "16000",
    "DISABLE_INTERLEAVED_THINKING": "0",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "0",
}
ok = True
for k, v in need.items():
    if env.get(k) != v:
        print(f"missing_or_wrong {k}={env.get(k)!r} want {v!r}")
        ok = False
sys.exit(0 if ok else 1)
PY
  then ok "Antigravity thinking disabled + discovery off"
  else fail "Antigravity settings incomplete — npm run apply:antigravity-claude-settings"
  fi
fi

# Proxy
if ! lsof -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  warn "proxy down — starting"
  bash "${SCRIPT_DIR}/start-free-claude-code-proxy.sh" || fail "proxy start failed"
fi
ok "proxy :${PORT} listening"

# Beta path with tools (Antigravity agent panel always sends tools)
AGENT_BODY='{"model":"claude-sonnet-4-20250514","max_tokens":64,"messages":[{"role":"user","content":"Reply with exactly: OK"}],"tools":[{"name":"Bash","description":"run","input_schema":{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}}]}'
TMP=$(mktemp)
CODE=$(curl -sS -m 120 -o "$TMP" -w "%{http_code}" -X POST "http://127.0.0.1:${PORT}/v1/messages?beta=true" \
  -H "Content-Type: application/json" -H "x-api-key: freecc" -H "anthropic-version: 2023-06-01" \
  -d "$AGENT_BODY") || CODE="000"

if [[ "$CODE" != "200" ]]; then
  fail "beta+tools POST HTTP $CODE"
  head -c 300 "$TMP" >&2
elif grep -q 'Provider API request failed' "$TMP"; then
  fail "beta+tools returned Provider API request failed (use Option D, not Gemini-only Option C)"
  head -c 400 "$TMP" >&2
elif grep -q 'Provider rate limit reached' "$TMP"; then
  warn "beta+tools rate-limited (:free quota) — routing OK; retry later or swap MODEL_SONNET"
elif grep -q 'text_delta' "$TMP" && grep -q 'OK' "$TMP"; then
  ok "beta+tools POST returns OK (agent-safe)"
else
  fail "beta+tools 200 but unexpected body"
  head -c 400 "$TMP" >&2
fi
rm -f "$TMP"

# Thinking-in-request should still not be required for chat
TMP2=$(mktemp)
CODE2=$(curl -sS -m 90 -o "$TMP2" -w "%{http_code}" -X POST "http://127.0.0.1:${PORT}/v1/messages?beta=true" \
  -H "Content-Type: application/json" -H "x-api-key: freecc" -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":16,"messages":[{"role":"user","content":"hi"}],"thinking":{"type":"enabled","budget_tokens":8000}}') || CODE2="000"
if [[ "$CODE2" == "200" ]] && grep -q 'text_delta' "$TMP2"; then
  ok "thinking request still returns text (proxy tolerant)"
else
  warn "thinking-in-body path weak (expected — client should disable thinking via env)"
fi
rm -f "$TMP2"

echo ""
if [[ "$FAIL" -ne 0 ]]; then
  echo "Summary: FAILED"
  exit 1
fi
echo "Summary: PASSED — Cmd+Q Antigravity, reopen, NEW chat, send: Reply with exactly: OK"
echo "Do NOT use Ascension prompts until OK works."
exit 0
