#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/dogfight/backups}"
LOCAL_BACKUP_RETENTION_HOURS="${LOCAL_BACKUP_RETENTION_HOURS:-72}"
OFFSITE_BACKUP_RETENTION_DAYS="${OFFSITE_BACKUP_RETENTION_DAYS:-30}"
BACKUP_REASON="${BACKUP_REASON:-scheduled}"
OFFSITE_BACKUP="${OFFSITE_BACKUP:-0}"
COS_PREFIX="${COS_PREFIX:-dogfight/postgres}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/dogfight-$BACKUP_REASON-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

alert() {
  message="$1"
  echo "$message" >&2
  if [ -n "$ALERT_WEBHOOK_URL" ] && command -v curl >/dev/null 2>&1; then
    curl -fsS -m 10 \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"DogFight backup alert: $message\"}" \
      "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true
  fi
}

fail() {
  alert "$1"
  exit 1
}

docker compose --env-file .env.production exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip -c > "$BACKUP_FILE" || fail "PostgreSQL backup dump failed"

[ -s "$BACKUP_FILE" ] || fail "PostgreSQL backup file is empty: $BACKUP_FILE"
gunzip -t "$BACKUP_FILE" || fail "PostgreSQL backup gzip validation failed: $BACKUP_FILE"
if ! gunzip -c "$BACKUP_FILE" | head -n 20 | grep -q 'PostgreSQL database dump'; then
  fail "PostgreSQL backup content validation failed: $BACKUP_FILE"
fi

find "$BACKUP_DIR" -type f -name 'dogfight-*.sql.gz' -mmin +"$((LOCAL_BACKUP_RETENTION_HOURS * 60))" -delete

if [ "$OFFSITE_BACKUP" = "1" ]; then
  [ -n "${COS_BUCKET:-}" ] || fail "COS_BUCKET is required for offsite backup"
  [ -n "${COS_REGION:-}" ] || fail "COS_REGION is required for offsite backup"
  [ -n "${COS_SECRET_ID:-}" ] || fail "COS_SECRET_ID is required for offsite backup"
  [ -n "${COS_SECRET_KEY:-}" ] || fail "COS_SECRET_KEY is required for offsite backup"
  command -v coscli >/dev/null 2>&1 || fail "coscli is required for offsite backup"

  COS_CONFIG="$BACKUP_DIR/.coscli-dogfight.yaml"
  umask 077
  cat > "$COS_CONFIG" <<EOF
cos:
  base:
    secretid: ${COS_SECRET_ID}
    secretkey: ${COS_SECRET_KEY}
    sessiontoken: ""
  buckets:
  - name: ${COS_BUCKET}
    alias: dogfight-backups
    region: ${COS_REGION}
    endpoint: cos.${COS_REGION}.myqcloud.com
EOF

  coscli -c "$COS_CONFIG" cp "$BACKUP_FILE" "cos://$COS_BUCKET/$COS_PREFIX/$(basename "$BACKUP_FILE")" \
    || fail "COS upload failed: $BACKUP_FILE"
  find "$BACKUP_DIR" -type f -name 'dogfight-*.sql.gz' -mtime +"$OFFSITE_BACKUP_RETENTION_DAYS" -delete
fi

echo "Created PostgreSQL backup: $BACKUP_FILE"
