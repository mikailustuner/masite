#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$PROJECT_DIR/.env.homeserver"

if [ -f "$ENV_FILE" ]; then
  chmod 600 "$ENV_FILE"
  echo "Home-server environment already exists: $ENV_FILE"
  exit 0
fi

if command -v openssl >/dev/null 2>&1; then
  random_hex() { openssl rand -hex "$1"; }
elif [ -r /dev/urandom ] && command -v od >/dev/null 2>&1; then
  random_hex() { od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'; }
else
  echo "A secure random source is required (openssl or /dev/urandom with od)." >&2
  exit 1
fi

POSTGRES_ADMIN_PASSWORD=$(random_hex 32)
APP_DATABASE_PASSWORD=$(random_hex 32)
REDIS_PASSWORD=$(random_hex 32)
S3_SECRET_KEY=$(random_hex 32)
SESSION_SECRET=$(random_hex 48)
BOOTSTRAP_ADMIN_PASSWORD=$(random_hex 24)

umask 077
{
  echo "# Evidera home server — generated for the private Tailscale address below."
  echo "EVIDERA_BIND_IP=100.104.207.55"
  echo "WEB_PORT=8080"
  echo "PUBLIC_APP_URL=http://100.104.207.55:8080"
  echo "POSTGRES_ADMIN_PASSWORD=$POSTGRES_ADMIN_PASSWORD"
  echo "APP_DATABASE_PASSWORD=$APP_DATABASE_PASSWORD"
  echo "REDIS_PASSWORD=$REDIS_PASSWORD"
  echo "S3_ACCESS_KEY=evidera"
  echo "S3_SECRET_KEY=$S3_SECRET_KEY"
  echo "SESSION_SECRET=$SESSION_SECRET"
  echo "BOOTSTRAP_ADMIN_EMAIL=admin@evidera.home"
  echo "BOOTSTRAP_ADMIN_PASSWORD=$BOOTSTRAP_ADMIN_PASSWORD"
  echo "BOOTSTRAP_ORGANIZATION_NAME='Evidera Home'"
  echo "CRAWLER_USER_AGENT='EvideraBot/0.1 (+http://100.104.207.55:8080/bot)'"
  echo "CRAWLER_CONTACT_URL=http://100.104.207.55:8080/bot"
  echo "CRUX_API_BASE_URL=https://chromeuxreport.googleapis.com/v1/records:queryRecord"
  echo "CRUX_API_KEY="
  echo "SERP_PROVIDER=serper"
  echo "SERP_API_BASE_URL=https://google.serper.dev/"
  echo "SERP_API_KEY="
  echo "SERP_DAILY_QUERY_LIMIT=50"
  echo "BACKLINK_PROVIDER=disabled"
  echo "BACKLINK_API_BASE_URL="
  echo "BACKLINK_API_KEY="
  echo "OPENPAGERANK_API_BASE_URL=https://openpagerank.keywordseverywhere.com/"
  echo "OPENPAGERANK_API_KEY="
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "Created secure home-server environment: $ENV_FILE"
