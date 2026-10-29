#!/bin/sh
# One backup run: pg_dump (gzip) + media tarball → /backups, prune > RETENTION days, optional S3 upload.
# Env: PGHOST PGDATABASE PGUSER PGPASSWORD, BACKUP_RETENTION_DAYS, BACKUP_MEDIA, BACKUP_PASSPHRASE,
#      BACKUP_S3_BUCKET BACKUP_S3_PREFIX BACKUP_S3_ENDPOINT AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
set -eu
umask 077
DIR=/backups
STAMP=$(date +%Y%m%d-%H%M%S)
RETENTION="${BACKUP_RETENTION_DAYS:-14}"

# Backups hold ID photos and personal data: never write them unencrypted.
[ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "BACKUP_PASSPHRASE is not set; refusing to write unencrypted backups" >&2; exit 1; }

encrypt() {  # $1 = file; replaces it with $1.gpg
  if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
    printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback \
      --passphrase-fd 0 --symmetric --cipher-algo AES256 -o "$1.gpg" "$1"
    rm -f "$1"
    echo "$1.gpg"
  else
    echo "$1"
  fi
}

DB_FILE="$DIR/db-$PGDATABASE-$STAMP.sql.gz"
echo "[$(date -Iseconds)] dumping database $PGDATABASE"
pg_dump --no-owner --no-privileges --clean --if-exists "$PGDATABASE" | gzip -9 > "$DB_FILE.tmp"
mv "$DB_FILE.tmp" "$DB_FILE"
gzip -t "$DB_FILE"
FILES=$(encrypt "$DB_FILE")

if [ "${BACKUP_MEDIA:-true}" = "true" ] && [ -d /media ] && [ -n "$(ls -A /media 2>/dev/null)" ]; then
  MEDIA_FILE="$DIR/media-$STAMP.tar.gz"
  echo "[$(date -Iseconds)] archiving media"
  tar -czf "$MEDIA_FILE" -C /media .
  FILES="$FILES $(encrypt "$MEDIA_FILE")"
fi

echo "[$(date -Iseconds)] pruning local backups older than $RETENTION days"
find "$DIR" -maxdepth 1 -type f \( -name 'db-*' -o -name 'media-*' \) -mtime +"$RETENTION" -print -delete

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  ENDPOINT=""
  [ -n "${BACKUP_S3_ENDPOINT:-}" ] && ENDPOINT="--endpoint-url $BACKUP_S3_ENDPOINT"
  for f in $FILES; do
    echo "[$(date -Iseconds)] uploading $(basename "$f") to s3://$BACKUP_S3_BUCKET/${BACKUP_S3_PREFIX:-kaamsathi}/"
    # shellcheck disable=SC2086
    aws $ENDPOINT s3 cp --only-show-errors "$f" "s3://$BACKUP_S3_BUCKET/${BACKUP_S3_PREFIX:-kaamsathi}/$(basename "$f")"
  done
  # Remote retention: configure a lifecycle rule on the bucket (e.g. expire after 30–90 days).
fi

echo "[$(date -Iseconds)] backup OK: $FILES"
