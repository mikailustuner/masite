#!/bin/sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKUP_DIR="$PROJECT_DIR/backups"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR"
docker compose --env-file .env.homeserver -f compose.homeserver.yml exec -T postgres pg_dump -U evidera_admin -d evidera -Fc > "$BACKUP_DIR/evidera-$STAMP.dump"
chmod 600 "$BACKUP_DIR/evidera-$STAMP.dump"
echo "Database backup created: $BACKUP_DIR/evidera-$STAMP.dump"
