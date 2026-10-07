#!/bin/sh
# Restore a database dump produced by backup.sh into $PGDATABASE (DESTRUCTIVE: drops existing objects).
#   restore.sh /backups/db-kaamsathi-20261007-020000.sql.gz[.gpg]
#   restore.sh --media /backups/media-20261007-020000.tar.gz[.gpg]   (needs /media mounted read-write)
# Normally called through `make restore FILE=...`, which stops the app and asks for confirmation.
set -eu
MODE=db
if [ "${1:-}" = "--media" ]; then MODE=media; shift; fi
FILE="${1:?usage: restore.sh [--media] <backup file>}"
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 1; }

decrypt() {
  case "$1" in
    *.gpg)
      [ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "BACKUP_PASSPHRASE required for $1" >&2; exit 1; }
      printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 0 -d "$1" ;;
    *) cat "$1" ;;
  esac
}

if [ "$MODE" = media ]; then
  echo "restoring media from $FILE into /media"
  decrypt "$FILE" | tar -xzf - -C /media
else
  echo "restoring database $PGDATABASE on $PGHOST from $FILE"
  decrypt "$FILE" | gunzip -c | psql -v ON_ERROR_STOP=1 --quiet --single-transaction "$PGDATABASE"
fi
echo "restore finished"
