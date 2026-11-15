#!/usr/bin/env bash
# Canonical free-claude-code local proxy bind (IDE + terminal + heal/fix bots).
# Override for experiments: FCC_PROXY_PORT=9000 bash scripts/...
: "${FCC_PROXY_PORT:=8082}"
export FCC_PROXY_PORT
export FCC_PROXY_HOST="${FCC_PROXY_HOST:-127.0.0.1}"
export FCC_PROXY_BASE_URL="http://${FCC_PROXY_HOST}:${FCC_PROXY_PORT}"
