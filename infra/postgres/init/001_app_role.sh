#!/bin/sh
set -eu

if [ -z "${APP_DATABASE_PASSWORD:-}" ]; then
  echo "APP_DATABASE_PASSWORD is required" >&2
  exit 1
fi

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DATABASE_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE evidera_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evidera_app') \gexec
GRANT CONNECT ON DATABASE evidera TO evidera_app;
GRANT USAGE ON SCHEMA public TO evidera_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO evidera_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO evidera_app;
SQL
