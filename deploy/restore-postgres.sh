#!/usr/bin/env sh
set -eu

RESTORE_BACKUP_FILE="${RESTORE_BACKUP_FILE:-${1:-}}"

if [ -z "$RESTORE_BACKUP_FILE" ]; then
  echo "Set RESTORE_BACKUP_FILE=/absolute/path/to/dogfight.sql.gz to restore." >&2
  exit 1
fi

if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
  echo "Refusing to restore without CONFIRM_RESTORE=YES." >&2
  echo "This command overwrites the target PostgreSQL database. Verify the backup in a temporary database first." >&2
  exit 1
fi

[ -f "$RESTORE_BACKUP_FILE" ] || {
  echo "Backup file not found: $RESTORE_BACKUP_FILE" >&2
  exit 1
}

gunzip -t "$RESTORE_BACKUP_FILE"
if ! gunzip -c "$RESTORE_BACKUP_FILE" | head -n 20 | grep -q 'PostgreSQL database dump'; then
  echo "Backup file does not look like a PostgreSQL database dump: $RESTORE_BACKUP_FILE" >&2
  exit 1
fi

docker compose --env-file .env.production exec -T postgres sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'

gunzip -c "$RESTORE_BACKUP_FILE" \
  | docker compose --env-file .env.production exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
