#!/bin/bash
# Gumroad catalog scheduler daemon — launchd wrapper.
# Loads storefront/.gumroad-env (KEY=VALUE lines) if present, then runs the
# scheduler. Safe default: without GUMROAD_API=1 + GUMROAD_ACCESS_TOKEN +
# GUMROAD_DELIVERY_BASE it only logs dry-run slots — it cannot post anything.
set -u
cd "$(dirname "$0")/.."
if [ -f .gumroad-env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.gumroad-env
  set +a
fi
exec /usr/local/bin/node gumroad-scheduler.mjs --daemon >> gumroad-daemon.log 2>&1
