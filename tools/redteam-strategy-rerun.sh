#!/bin/bash
# redteam-strategy-rerun.sh — scheduled rerun of the promptfoo iterative
# strategy tests (jailbreak + prompt-injection metas) deferred from the
# 2026-11-21 baseline because NVIDIA NIM rate limits made the full 50-test
# run impractical.
#
# Runs nightly via launchd (com.cortex.redteam-rerun). Skips early once a
# clean pass has been recorded (.cortex-runtime/redteam-STRATEGIES-PASS.json).
# Results + notifications land in .cortex-runtime/eventlog/.

set -uo pipefail
cd /Users/Apple/syncscript

LOGDIR=.cortex-runtime/eventlog
LOG="$LOGDIR/redteam-strategies-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOGDIR"
PASS_MARKER=.cortex-runtime/redteam-STRATEGIES-PASS.json
DB="$HOME/.promptfoo/promptfoo.db"

notify() { osascript -e "display notification \"$2\" with title \"$1\"" 2>/dev/null || true; }

if [ -f "$PASS_MARKER" ]; then
  echo "$(date -u +%FT%TZ) SKIP — pass marker exists" >> "$LOG"
  exit 0
fi

# Require the local proxy; nothing to test otherwise.
if ! curl -sf -m 5 http://127.0.0.1:3425/v1/models >/dev/null 2>&1; then
  echo "$(date -u +%FT%TZ) SKIP — magpie proxy unreachable" >> "$LOG"
  notify "Cortex redteam" "Skipped — magpie proxy unreachable"
  exit 0
fi

echo "$(date -u +%FT%TZ) START redteam-strategies eval" >> "$LOG"
npx dotenvx run -f .env -- npx promptfoo eval -c redteam/redteam-strategies.yaml --no-cache >> "$LOG" 2>&1
RC=$?

EVALID=$(grep -oE 'eval-[A-Za-z0-9]+-[0-9T:-]+' "$LOG" | tail -1)
SUMMARY="$LOGDIR/redteam-strategies-latest.json"

if [ -n "$EVALID" ] && [ -f "$DB" ]; then
  sqlite3 "$DB" "SELECT COUNT(*), COALESCE(SUM(success),0), COALESCE(SUM(CASE WHEN error IS NOT NULL AND error != '' THEN 1 ELSE 0 END),0) FROM eval_results WHERE eval_id='$EVALID'" | \
  python3 -c "
import json,sys,datetime
n,s,e = map(int, sys.stdin.read().split())
rate = (s/n) if n else 0
out = {'evalId':'$EVALID','total':n,'passed':s,'errors':e,'passRate':round(rate,3),'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
open('$SUMMARY','w').write(json.dumps(out,indent=2))
print(json.dumps(out))
if e == 0 and rate >= 0.9:
    open('$PASS_MARKER','w').write(json.dumps(out,indent=2))
    print('PASS_MARKER written')
" >> "$LOG" 2>&1
fi

TAIL=$(tail -5 "$LOG" | tr '\n' ' ' | cut -c1-200)
if [ -f "$PASS_MARKER" ] && tail -20 "$LOG" | grep -q PASS_MARKER; then
  notify "Cortex redteam" "Strategy tests PASSED — baseline clean"
else
  notify "Cortex redteam" "Run finished (rc=$RC) — see $SUMMARY"
fi
echo "$(date -u +%FT%TZ) DONE rc=$RC eval=$EVALID" >> "$LOG"
exit $RC
