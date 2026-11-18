#!/usr/bin/env bash
# Nightly database backup on the VPS. Installed as a root cron job:
#
#   30 2 * * * /srv/faithtribe/deploy/backup.sh >> /var/log/faithtribe-backup.log 2>&1
#
# Writes a custom-format dump (restore with pg_restore) to $BACKUP_DIR, keeps
# $KEEP_DAYS days of them, and, when rclone has a remote named in
# $RCLONE_REMOTE, copies each one off the server. A copy that lives only on
# this machine dies with it, so set the remote up (docs/ops/11 §Backups).
#
# The dumps hold minors' personal data: the directory is root-only.
set -o errexit -o nounset -o pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/srv/faithtribe/deploy/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/faithtribe}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"   # e.g. r2:faithtribe-private/db-backups

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp="$(date -u +%Y%m%d-%H%M)"
target="$BACKUP_DIR/faithtribe-$stamp.dump"
partial="$target.partial"
trap 'rm -f -- "$partial"' EXIT

docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U faithtribe -d faithtribe --format=custom --no-owner --no-privileges \
  > "$partial"

# A dump pg_restore cannot list is not a backup.
docker compose -f "$COMPOSE_FILE" exec -T db pg_restore --list < "$partial" > /dev/null
mv -- "$partial" "$target"
echo "$(date -u +%FT%TZ) wrote $target ($(du -h "$target" | cut -f1))"

if [ -n "$RCLONE_REMOTE" ]; then
  rclone copy "$target" "$RCLONE_REMOTE"
  echo "$(date -u +%FT%TZ) copied to $RCLONE_REMOTE"
fi

find "$BACKUP_DIR" -name 'faithtribe-*.dump' -mtime +"$KEEP_DAYS" -delete
