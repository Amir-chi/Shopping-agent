#!/bin/sh
set -eu
python manage.py migrate --noinput
if [ "${CATALOG_AUTO_IMPORT:-true}" = "true" ]; then
  source="${CATALOG_IMPORT_PATH:-/import/catalog.sqlite3}"
  case "$source" in
    *.zip) python manage.py import_catalog --zip "$source" --if-empty ;;
    *) python manage.py import_catalog --sqlite "$source" --if-empty ;;
  esac
fi
python manage.py collectstatic --noinput --verbosity 0
exec "$@"
