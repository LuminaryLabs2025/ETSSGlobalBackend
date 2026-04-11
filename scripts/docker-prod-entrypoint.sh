#!/bin/sh
# Production container: optionally seed DB before starting the API.
# Set RUN_SEED_ON_DEPLOY=true (e.g. on Render) to run seeds once per deploy.
set -e

if [ "${RUN_SEED_ON_DEPLOY}" = "true" ] || [ "${RUN_SEED_ON_DEPLOY}" = "1" ]; then
  echo "[entrypoint] RUN_SEED_ON_DEPLOY is set — running database seed..."
  node dist/database/seeds/index.js
fi

echo "[entrypoint] Starting application..."
exec node dist/main.js
