#!/bin/sh
set -e
LOCK_HASH_FILE=/app/node_modules/.lock-hash
# Hash both files so any dependency change triggers a reinstall.
LOCK_HASH=$(cat package-lock.json package.json | md5sum | awk '{print $1}')

MISSING_DEPS=false
if [ ! -d node_modules/exceljs ] || [ ! -d node_modules/pdfkit ]; then
  MISSING_DEPS=true
fi

if [ ! -f "$LOCK_HASH_FILE" ] || [ "$(cat "$LOCK_HASH_FILE")" != "$LOCK_HASH" ] || [ "$MISSING_DEPS" = true ]; then
  echo "Installing dependencies (package files changed, fresh volume, or missing packages)..."
  npm ci
  echo "$LOCK_HASH" > "$LOCK_HASH_FILE"
fi
exec "$@"
