#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/dogfight/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

docker compose --env-file .env.production exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "$BACKUP_DIR/dogfight-$TIMESTAMP.sql"

find "$BACKUP_DIR" -type f -name 'dogfight-*.sql' -mtime +7 -delete
