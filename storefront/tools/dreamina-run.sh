#!/bin/bash
# dreamina-run.sh — detached Dreamina generation job.
# Usage: dreamina-run.sh <jobId> <prompt> <ratio> <resolution> <outName> [projectId]
# Writes status to storefront/assets/dreamina/.jobs/<jobId>.json
set -u
JOB_ID="$1"; PROMPT="$2"; RATIO="$3"; RES="$4"; OUTNAME="$5"; PROJECT="${6:-2f0a70f2-fca6-4aab-8235-5bcdbd0e0db4}"
D=/Users/Apple/.local/bin/dreamina-canvas
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JOBS="$ROOT/assets/dreamina/.jobs"
OUTDIR="$ROOT/assets/dreamina"
mkdir -p "$JOBS" "$OUTDIR"
STATUS="$JOBS/$JOB_ID.json"

write_status() { # state message [resourceId] [file]
  cat > "$STATUS" <<EOF
{"jobId":"$JOB_ID","state":"$1","message":$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$2"),"resourceId":"${3:-}","file":"${4:-}","updatedAt":$(date +%s)000}
EOF
}

write_status running "creating image node"
CREATE_JSON=$("$D" node create image \
  --project-id "$PROJECT" --model seedream_4.6 --mode t2i \
  --prompt "$PROMPT" --ratio "$RATIO" --resolution "$RES" \
  --title "$OUTNAME" --run --wait --yes --non-interactive --format json 2>&1)
RC=$?
if [ $RC -ne 0 ]; then
  write_status failed "create/run exited $RC: $(echo "$CREATE_JSON" | tail -c 400)"
  exit 1
fi

# Extract resource id(s) from JSON output — try common shapes.
RES_ID=$(echo "$CREATE_JSON" | python3 -c '
import json,sys
raw=sys.stdin.read()
try:
    d=json.loads(raw)
except Exception:
    # find first {...} blob
    i=raw.find("{"); d=json.loads(raw[i:]) if i>=0 else {}
def walk(o):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in ("resourceId","resource_id","id") and isinstance(v,str) and v: yield v
            else: yield from walk(v)
    elif isinstance(o,list):
        for v in o: yield from walk(v)
ids=list(walk(d))
print(ids[0] if ids else "")
' 2>/dev/null)

if [ -z "$RES_ID" ]; then
  write_status failed "could not parse resourceId from output"
  exit 1
fi

write_status downloading "resource $RES_ID"
"$D" resource download "$RES_ID" --project-id "$PROJECT" -o "$OUTDIR" --yes --non-interactive >/dev/null 2>&1
# Find the downloaded file (service-provided name) matching newest png in OUTDIR root
FILE=$(ls -t "$OUTDIR"/*.png 2>/dev/null | head -1)
if [ -z "$FILE" ]; then
  write_status failed "download produced no file for $RES_ID"
  exit 1
fi
# Rename to stable outname if provided
if [ -n "$OUTNAME" ]; then
  DEST="$OUTDIR/${OUTNAME}.png"
  [ "$FILE" != "$DEST" ] && mv "$FILE" "$DEST" && FILE="$DEST"
fi
write_status done "generated" "$RES_ID" "$FILE"
