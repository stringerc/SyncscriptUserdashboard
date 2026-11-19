#!/usr/bin/env bash
# ifixai-when-ready.sh — probe-gated iFixAi audit runner.
#
# The graded audit needs TWO healthy routes simultaneously:
#   SUT   — the Cortex audit shim (reason lane by default; fast lane fallback)
#   Judge — an OpenAI-compatible chat endpoint that returns parseable verdicts
#
# Free-tier providers saturate independently (NIM congestion, Groq TPD/RPD,
# OpenRouter credit, magpie group health). This script probes both routes and
# only fires the audit when both answer inside budget — implementing
# "run when ready" instead of burning attempts into 429s.
#
# Usage:
#   scripts/ifixai-when-ready.sh            # probe → run when ready (blocks)
#   scripts/ifixai-when-ready.sh --once     # single probe cycle, exit 1 if not ready
#   WATCH=1 scripts/ifixai-when-ready.sh    # re-probe every 5 min until ready
#
# Env overrides: JUDGE_BASE_URL JUDGE_API_KEY JUDGE_MODEL SUT_MODEL
#                PROBE_TIMEOUT_S RETRY_EVERY_S
set -u
cd "$(dirname "$0")/.."

VITE="http://127.0.0.1:5173"
SHIM="$VITE/api/cortex/audit/chat/completions"
FIXTURE="config/ifixai/cortex-agent.yaml"
OUT_DIR=".cortex-runtime/audit"
IFIXAI="${IFIXAI_BIN:-$HOME/.local/bin/ifixai}"
PROBE_TIMEOUT_S="${PROBE_TIMEOUT_S:-25}"
RETRY_EVERY_S="${RETRY_EVERY_S:-300}"

# Judge defaults: NIM gemma via OPENAI_BASE_URL from .env (proven verdicts).
# Override JUDGE_BASE_URL/JUDGE_API_KEY/JUDGE_MODEL to fail over to Groq etc.
set -a; [ -f .env ] && source .env; set +a
JUDGE_BASE_URL="${JUDGE_BASE_URL:-${OPENAI_BASE_URL:-https://integrate.api.nvidia.com/v1}}"
JUDGE_API_KEY="${JUDGE_API_KEY:-${OPENAI_API_KEY:-}}"
JUDGE_MODEL="${JUDGE_MODEL:-${IFIXAI_JUDGE_MODEL:-google/gemma-4-31b-it}}"
SUT_MODEL="${SUT_MODEL:-}"   # empty = reason tier default (full lane failover)

ts() { date '+%H:%M:%S'; }

probe() { # $1=url $2=key $3=model $4=extra-json
  curl -s -m "$PROBE_TIMEOUT_S" "$1" \
    -H 'content-type: application/json' \
    -H "Authorization: Bearer $2" \
    -d "{\"model\":\"$3\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: OK\"}],\"max_tokens\":60,\"temperature\":0${4:-}}" \
    | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    c=(d.get('choices') or [{}])[0].get('message',{}).get('content') or ''
    sys.exit(0 if c.strip() else 1)
except Exception:
    sys.exit(1)" 2>/dev/null
}

judge_ready() {
  probe "$JUDGE_BASE_URL/chat/completions" "$JUDGE_API_KEY" "$JUDGE_MODEL"
}

# SUT probe mirrors what fire() will run. Default = reason lane; if reason is
# degraded but fast answers, downgrade the run to the fast lane (same governed
# path, same charter — tier is infra, not the thing under audit).
SUT_TIER="${SUT_MODEL:-reason}"

sut_ready() {
  local tier="$1" m=""
  [ "$tier" != "reason" ] && m=",\"model\":\"$tier\""
  curl -s -m "$PROBE_TIMEOUT_S" "$SHIM" \
    -H 'content-type: application/json' \
    -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: OK\"}],\"max_tokens\":80$m}" \
    | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    c=(d.get('choices') or [{}])[0].get('message',{}).get('content') or ''
    sys.exit(0 if c.strip() else 1)
except Exception:
    sys.exit(1)" 2>/dev/null
}

pick_sut_tier() {
  if [ -n "$SUT_MODEL" ]; then SUT_TIER="$SUT_MODEL"; return 0; fi
  if sut_ready reason; then SUT_TIER="reason"; return 0; fi
  if sut_ready fast; then SUT_TIER="fast"; return 0; fi
  return 1
}

fire() {
  local args=(run --provider http --endpoint "$SHIM" --auth-method none
    --eval-mode single --timeout 150 --grounding fixture
    --judge-provider openai --judge-model "$JUDGE_MODEL"
    -f "$FIXTURE" -o "$OUT_DIR")
  [ "$SUT_TIER" != "reason" ] && args+=(--model "$SUT_TIER")
  echo "[$(ts)] firing: $IFIXAI ${args[*]}"
  echo "[$(ts)] judge=$JUDGE_BASE_URL model=$JUDGE_MODEL | sut=$SUT_TIER"
  OPENAI_BASE_URL="$JUDGE_BASE_URL" OPENAI_API_KEY="$JUDGE_API_KEY" \
    "$IFIXAI" "${args[@]}" 2>&1 | tee -a /tmp/ifixai-when-ready.log
}

cycle=0
while true; do
  cycle=$((cycle+1))
  jr=0; sr=0
  judge_ready && jr=1
  pick_sut_tier && sr=1
  echo "[$(ts)] cycle $cycle — judge:$jr sut:$sr tier:${SUT_TIER:-none}"
  if [ "$jr" = 1 ] && [ "$sr" = 1 ]; then
    echo "[$(ts)] both routes healthy — running audit"
    fire
    exit $?
  fi
  [ "${1:-}" = "--once" ] && { echo "[$(ts)] not ready"; exit 1; }
  sleep "$RETRY_EVERY_S"
done
