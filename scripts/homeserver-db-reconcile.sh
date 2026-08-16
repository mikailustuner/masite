#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$PROJECT_DIR/.env.homeserver"
COMPOSE_FILE="$PROJECT_DIR/compose.homeserver.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

cd "$PROJECT_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres sh -eu -c '
exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 --set=admin_password="$POSTGRES_PASSWORD" --set=app_password="$APP_DATABASE_PASSWORD"
' <<'SQL'
ALTER ROLE evidera_admin WITH LOGIN PASSWORD :'admin_password';
SELECT format('CREATE ROLE evidera_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evidera_app') \gexec
ALTER ROLE evidera_app WITH LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT CONNECT ON DATABASE evidera TO evidera_app;
GRANT USAGE ON SCHEMA public TO evidera_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO evidera_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO evidera_app;
SQL

echo "PostgreSQL roles match .env.homeserver."
