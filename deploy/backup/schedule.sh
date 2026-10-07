#!/bin/sh
# Runs backup.sh every day at BACKUP_HOUR (container TZ, default Asia/Kathmandu). No cron/root needed.
set -eu
HOUR="${BACKUP_HOUR:-2}"
echo "backup scheduler: daily at ${HOUR}:00 $(date +%Z), retention ${BACKUP_RETENTION_DAYS:-14} days"
while true; do
  now=$(date +%s)
  target=$(date -d "$(date +%Y-%m-%d) ${HOUR}:00:00" +%s 2>/dev/null || date -D '%Y-%m-%d %H:%M:%S' -d "$(date +%Y-%m-%d) ${HOUR}:00:00" +%s)
  if [ "$target" -le "$now" ]; then target=$((target + 86400)); fi
  sleep $((target - now))
  /usr/local/bin/backup.sh || echo "backup FAILED at $(date -Iseconds)" >&2
done
