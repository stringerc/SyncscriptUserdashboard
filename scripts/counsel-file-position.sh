#!/usr/bin/env bash
# counsel-file-position.sh — file a counsel position into the drop-folder.
#
# External counsel members (Antigravity, Claude Code, Cursor, scripts) use
# this instead of the API. The tower board's sessions GET auto-ingests
# .cortex-runtime/counsel/positions/<session>-<member>.json on next poll.
#
# Usage:
#   counsel-file-position.sh <session-id> <member> <go|no-go|conditional> <confidence> \
#       "evidence line 1" "evidence line 2" ... -- "reasoning text"
#
# Evidence is REQUIRED (Evidence or Silence) — at least one item.
# Example:
#   counsel-file-position.sh csl-f4005a01 antigravity conditional 0.7 \
#       "spec CORTEX_COUNSEL_SPEC.md reviewed" "no mutation path in diff" \
#       -- "advisory-only is correct scope for v1"
set -euo pipefail

SESSION="${1:?session id required (csl-xxxx)}"
MEMBER="${2:?member id required (e.g. antigravity, claude-code, cursor)}"
STANCE="${3:?stance required: go|no-go|conditional}"
CONF="${4:?confidence 0..1 required}"
shift 4

EVIDENCE=()
REASONING=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--" ]]; then shift; REASONING="${*:-}"; break; fi
  EVIDENCE+=("$1"); shift
done

if [[ ${#EVIDENCE[@]} -eq 0 ]]; then
  echo "ERROR: at least one evidence item required (Evidence or Silence)" >&2
  exit 1
fi
if [[ -z "$REASONING" ]]; then
  echo "ERROR: reasoning required after --" >&2
  exit 1
fi
case "$STANCE" in go|no-go|conditional) ;; *) echo "ERROR: bad stance" >&2; exit 1;; esac

RUNTIME="${CORTEX_AGENTS_STATE_DIR:-$(cd "$(dirname "$0")/.." && pwd)/.cortex-runtime}"
DIR="$RUNTIME/counsel/positions"
mkdir -p "$DIR"
OUT="$DIR/${SESSION}-${MEMBER}.json"

COUNSEL_REASONING="$REASONING" python3 - "$OUT" "$SESSION" "$MEMBER" "$STANCE" "$CONF" "${EVIDENCE[@]}" <<'PYEOF'
import json, sys, time
out, session, member, stance, conf = sys.argv[1:6]
evidence, reasoning = [], ''
# argv[6:] are evidence items; reasoning appended last with \x00 separator not needed —
# reasoning passed via env instead for safety.
reasoning = __import__('os').environ.get('COUNSEL_REASONING', '')
pos = {
    "member": member, "stance": stance,
    "confidence": float(conf),
    "keyEvidence": sys.argv[6:],
    "risks": [], "requiredConditions": [],
    "reasoning": reasoning[:400],
    "filedVia": "drop-folder", "filedAt": int(time.time() * 1000),
}
with open(out, 'w') as f:
    json.dump(pos, f, indent=1)
print(f"position filed → {out}")
PYEOF
