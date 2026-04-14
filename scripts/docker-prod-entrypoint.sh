#!/bin/sh
# Production container: optionally run migrations + seed before starting the API.
# Set RUN_MIGRATIONS_ON_DEPLOY=true (e.g. on Render) to run pending migrations.
# Set RUN_SEED_ON_DEPLOY=true to run dist/database/seeds/index.js.
set -e

if [ "${RUN_MIGRATIONS_ON_DEPLOY}" = "true" ] || [ "${RUN_MIGRATIONS_ON_DEPLOY}" = "1" ]; then
  echo "[entrypoint] RUN_MIGRATIONS_ON_DEPLOY is set — running pending migrations..."
  node ./node_modules/typeorm/cli.js migration:run -d dist/config/typeorm.config.js
fi

if [ "${RUN_SEED_ON_DEPLOY}" = "true" ] || [ "${RUN_SEED_ON_DEPLOY}" = "1" ]; then
  echo "[entrypoint] RUN_SEED_ON_DEPLOY is set — running database seed..."
  node dist/database/seeds/index.js
fi

echo "[entrypoint] Starting application..."
exec node dist/main.js
