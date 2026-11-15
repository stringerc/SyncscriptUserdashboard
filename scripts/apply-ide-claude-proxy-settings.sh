#!/usr/bin/env bash
# Apply L2 free-claude-code proxy env to VS Code–family IDEs
# (Antigravity, Cursor, Devin, Windsurf).
# Patches claudeCode.environmentVariables — only sets proxy token freecc
# (does not strip other env entries such as GITHUB_TOKEN already present).
#
# Usage:
#   bash scripts/apply-ide-claude-proxy-settings.sh --all
#   bash scripts/apply-ide-claude-proxy-settings.sh --cursor
#   bash scripts/apply-ide-claude-proxy-settings.sh --antigravity
#   bash scripts/apply-ide-claude-proxy-settings.sh --devin
#   bash scripts/apply-ide-claude-proxy-settings.sh --windsurf
#   bash scripts/apply-ide-claude-proxy-settings.sh /path/to/settings.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/fcc-proxy-defaults.sh
source "${SCRIPT_DIR}/fcc-proxy-defaults.sh"

TOKEN="${FCC_ANTHROPIC_AUTH_TOKEN:-freecc}"
PROXY_PORT="${FCC_PROXY_PORT}"
TARGETS=()

usage() {
  cat <<EOF
Usage: apply-ide-claude-proxy-settings.sh [--cursor] [--antigravity] [--devin] [--windsurf] [--all] [settings.json ...]

  Default (no args): --all

  Sets ANTHROPIC_BASE_URL=http://127.0.0.1:${PROXY_PORT} and thinking-off env for readable proxy chat.
  Devin: also ensures devin.acp prefers claude-code (when those keys already exist or can be set safely).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cursor)
      TARGETS+=("${CURSOR_SETTINGS:-${HOME}/Library/Application Support/Cursor/User/settings.json}")
      shift
      ;;
    --antigravity)
      TARGETS+=("${ANTIGRAVITY_SETTINGS:-${HOME}/Library/Application Support/Antigravity/User/settings.json}")
      shift
      ;;
    --devin)
      TARGETS+=("${DEVIN_SETTINGS:-${HOME}/Library/Application Support/Devin/User/settings.json}")
      shift
      ;;
    --windsurf)
      TARGETS+=("${WINDSURF_SETTINGS:-${HOME}/Library/Application Support/Windsurf/User/settings.json}")
      shift
      ;;
    --all)
      TARGETS+=(
        "${ANTIGRAVITY_SETTINGS:-${HOME}/Library/Application Support/Antigravity/User/settings.json}"
        "${CURSOR_SETTINGS:-${HOME}/Library/Application Support/Cursor/User/settings.json}"
        "${DEVIN_SETTINGS:-${HOME}/Library/Application Support/Devin/User/settings.json}"
        "${WINDSURF_SETTINGS:-${HOME}/Library/Application Support/Windsurf/User/settings.json}"
      )
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      TARGETS+=("$1")
      shift
      ;;
  esac
done

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS+=(
    "${ANTIGRAVITY_SETTINGS:-${HOME}/Library/Application Support/Antigravity/User/settings.json}"
    "${CURSOR_SETTINGS:-${HOME}/Library/Application Support/Cursor/User/settings.json}"
    "${DEVIN_SETTINGS:-${HOME}/Library/Application Support/Devin/User/settings.json}"
    "${WINDSURF_SETTINGS:-${HOME}/Library/Application Support/Windsurf/User/settings.json}"
  )
fi

export PROXY_PORT TOKEN
UPDATED=0
SKIPPED=0

for path in "${TARGETS[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "SKIP: settings not found: $path" >&2
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  export SETTINGS_PATH="$path"
  python3 <<'PY'
import json, os, shutil, sys
from datetime import datetime, timezone

path = os.environ["SETTINGS_PATH"]
port = os.environ["PROXY_PORT"]
token = os.environ["TOKEN"]

# Thinking ON — reasoning models (minimax/gpt-oss/glm) perform much better
# with budgeted thinking. Do not force-disable (old anti-loop defaults).
desired = {
    "ANTHROPIC_BASE_URL": f"http://127.0.0.1:{port}",
    "ANTHROPIC_AUTH_TOKEN": token,
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "0",
    "CLAUDE_CODE_DISABLE_THINKING": "0",
    "MAX_THINKING_TOKENS": "16000",
    "DISABLE_INTERLEAVED_THINKING": "0",
}

backup = f"{path}.bak.syncscript-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
shutil.copy2(path, backup)

with open(path, encoding="utf-8") as f:
    data = json.load(f)

env_list = data.get("claudeCode.environmentVariables") or []
by_name = {e["name"]: e for e in env_list if isinstance(e, dict) and "name" in e}

for name, value in desired.items():
    by_name[name] = {"name": name, "value": value}

data["claudeCode.environmentVariables"] = [by_name[k] for k in sorted(by_name)]

# Devin ACP: prefer Claude Code path that respects claudeCode.environmentVariables
if "Devin" in path or path.endswith("Devin/User/settings.json"):
    data.setdefault("devin.acp.preferredAgent", "claude-code")
    enabled = data.get("devin.acp.enabledAgents")
    if not isinstance(enabled, dict):
        enabled = {}
    enabled["claude-code"] = True
    data["devin.acp.enabledAgents"] = enabled
    data.setdefault("claudeCode.preferredLocation", "panel")

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=4)
    f.write("\n")

print(f"OK:   {path}")
print(f"      backup: {backup}")
for k, v in desired.items():
    if "TOKEN" in k or "KEY" in k:
        print(f"      {k}=…")
    else:
        print(f"      {k}={v}")
if "Devin" in path:
    print("      devin.acp.preferredAgent=claude-code")
PY
  UPDATED=$((UPDATED + 1))
done

echo ""
echo "== apply-ide-claude-proxy-settings =="
echo "Port: ${PROXY_PORT} | updated: ${UPDATED} | skipped: ${SKIPPED}"
echo ""
echo "Next:"
echo "  1. Proxy running: bash scripts/verify-claude-code-proxy-lane.sh"
echo "  2. Quit and reopen each IDE (Cmd+Q) so Claude Code reloads env"
echo "  3. NEW Claude chat → Reply with exactly: OK"
echo "  4. bash scripts/verify-cursor-claude-compat.sh  (Cursor)"
echo "  5. bash scripts/verify-antigravity-claude-compat.sh  (Antigravity)"
echo "  6. bash scripts/verify-devin-claude-compat.sh  (Devin.app)"

if [[ "$UPDATED" -eq 0 ]]; then
  exit 1
fi
