#!/bin/sh
set -e
# Only the API container sets RUN_MIGRATIONS, so workers don't race on migrations.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  python manage.py migrate --noinput
  python manage.py seed_reference
fi
exec "$@"
