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

port_is_used_by_other_service() {
  candidate_port="$1"
  owners=$(docker ps --filter "publish=$candidate_port" --format '{{.Names}}' 2>/dev/null || true)
  if [ -n "$owners" ]; then
    non_evidera_owners=$(echo "$owners" | grep -Ev '^evidera-homeserver-web-[0-9]+$' || true)
    [ -z "$non_evidera_owners" ] && return 1
    return 0
  fi
  if command -v ss >/dev/null 2>&1 && ss -H -ltn "sport = :$candidate_port" 2>/dev/null | grep -q .; then
    return 0
  fi
  return 1
}

requested_port=${WEB_PORT:-8080}
selected_port=$requested_port
if port_is_used_by_other_service "$selected_port"; then
  selected_port=8081
  while [ "$selected_port" -le 8099 ] && port_is_used_by_other_service "$selected_port"; do
    selected_port=$((selected_port + 1))
  done
  if [ "$selected_port" -gt 8099 ]; then
    echo "No free web port was found in the 8081-8099 range." >&2
    exit 1
  fi
  echo "Port $requested_port is already in use; using $selected_port for Evidera."
fi

WEB_PORT=$selected_port
PUBLIC_APP_URL="http://$EVIDERA_BIND_IP:$WEB_PORT"
CRAWLER_CONTACT_URL="$PUBLIC_APP_URL/bot"
CRAWLER_USER_AGENT="EvideraBot/0.1 (+$CRAWLER_CONTACT_URL)"
export WEB_PORT PUBLIC_APP_URL CRAWLER_CONTACT_URL CRAWLER_USER_AGENT

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
