#!/bin/sh
# Run seeds against the app service in docker compose (dev stack).
set -e
cd "$(dirname "$0")/.."
docker compose exec app npm run seed
