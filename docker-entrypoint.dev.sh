#!/bin/sh
set -e
LOCK_HASH_FILE=/app/node_modules/.lock-hash
LOCK_HASH=$(md5sum package-lock.json | awk '{print $1}')
if [ ! -f "$LOCK_HASH_FILE" ] || [ "$(cat "$LOCK_HASH_FILE")" != "$LOCK_HASH" ]; then
  echo "Installing dependencies (package-lock changed or fresh volume)..."
  npm ci
  echo "$LOCK_HASH" > "$LOCK_HASH_FILE"
fi
exec "$@"
