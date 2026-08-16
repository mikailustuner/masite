#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$PROJECT_DIR/.env.homeserver"
COMPOSE_FILE="$PROJECT_DIR/compose.homeserver.yml"

if [ ! -f "$ENV_FILE" ]; then
  "$PROJECT_DIR/scripts/homeserver-env.sh"
fi

chmod 600 "$ENV_FILE"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found in PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required (docker compose)." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for the readiness check." >&2
  exit 1
fi

set -a
# The file is generated for this repository and contains shell-compatible values.
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if command -v ip >/dev/null 2>&1 && ! ip -o address show | grep -Fq " $EVIDERA_BIND_IP/"; then
  echo "Tailscale address $EVIDERA_BIND_IP is not assigned on this server." >&2
  echo "Start Tailscale and verify the address with: tailscale ip -4" >&2
  exit 1
fi

HEALTH_URL="${PUBLIC_APP_URL%/}/api/health/ready"

cd "$PROJECT_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --remove-orphans

attempt=0
until curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "Evidera did not become ready. Run: ./scripts/homeserver-logs.sh" >&2
    exit 1
  fi
  sleep 2
done

echo "Evidera is ready: $PUBLIC_APP_URL"
echo "Login email: $BOOTSTRAP_ADMIN_EMAIL"
echo "Login password is stored in .env.homeserver as BOOTSTRAP_ADMIN_PASSWORD"
