#!/bin/sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_DIR"
exec docker compose --env-file .env.homeserver -f compose.homeserver.yml logs --tail=200 -f
