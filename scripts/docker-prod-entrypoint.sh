#!/bin/sh
# Production container: optionally run migrations + seed before starting the API.
# Set RUN_MIGRATIONS_ON_DEPLOY=true (e.g. on Render) to run pending migrations.
# Set RUN_SEED_ON_DEPLOY=true to run dist/database/seeds/index.js.
set -e

TYPEORM_CONFIG="dist/config/typeorm.config.js"
MAIN_ENTRY="dist/main.js"

if [ ! -f "$TYPEORM_CONFIG" ]; then
  # Fallback if a misconfigured build preserved the src/ nesting under dist/
  if [ -f "dist/src/config/typeorm.config.js" ]; then
    TYPEORM_CONFIG="dist/src/config/typeorm.config.js"
    MAIN_ENTRY="dist/src/main.js"
  else
    echo "[entrypoint] ERROR: TypeORM config not found at dist/config/typeorm.config.js"
    echo "[entrypoint] Ensure nest build emits files under dist/ (not dist/src/). Check tsconfig.build.json excludes scripts/."
    exit 1
  fi
fi

if [ "${RUN_MIGRATIONS_ON_DEPLOY}" = "true" ] || [ "${RUN_MIGRATIONS_ON_DEPLOY}" = "1" ]; then
  echo "[entrypoint] RUN_MIGRATIONS_ON_DEPLOY is set — running pending migrations..."
  node ./node_modules/typeorm/cli.js migration:run -d "$TYPEORM_CONFIG"
fi

if [ "${RUN_SEED_ON_DEPLOY}" = "true" ] || [ "${RUN_SEED_ON_DEPLOY}" = "1" ]; then
  echo "[entrypoint] RUN_SEED_ON_DEPLOY is set — running database seed..."
  SEED_ENTRY="dist/database/seeds/index.js"
  if [ ! -f "$SEED_ENTRY" ] && [ -f "dist/src/database/seeds/index.js" ]; then
    SEED_ENTRY="dist/src/database/seeds/index.js"
  fi
  node "$SEED_ENTRY"
fi

echo "[entrypoint] Starting application..."
exec node "$MAIN_ENTRY"