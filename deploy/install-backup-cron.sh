#!/usr/bin/env sh
set -eu

DEPLOY_PATH="${DEPLOY_PATH:-/opt/dogfight}"
CRON_FILE="/etc/cron.d/dogfight-postgres-backup"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo."
  exit 1
fi

cat > "$CRON_FILE" <<EOF
17 * * * * root cd $DEPLOY_PATH && BACKUP_DIR=$DEPLOY_PATH/backups sh deploy/backup-postgres.sh
23 3 * * * root cd $DEPLOY_PATH && BACKUP_DIR=$DEPLOY_PATH/backups OFFSITE_BACKUP=1 sh deploy/backup-postgres.sh
EOF

chmod 0644 "$CRON_FILE"
