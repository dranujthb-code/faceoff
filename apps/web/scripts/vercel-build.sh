#!/usr/bin/env bash
# Vercel build: apply database migrations (and optionally seed) before building the app.
# Migrations are idempotent and tracked in public.schema_migrations; seeding is idempotent.
set -euo pipefail
if [[ -n "${DATABASE_ADMIN_URL:-}" ]]; then
  echo "▶ Applying database migrations"
  npx tsx scripts/migrate.ts
  if [[ "${SEED_ON_DEPLOY:-false}" == "true" ]]; then
    echo "▶ Seeding reference data"
    npx tsx scripts/seed.ts
  fi
else
  echo "⚠ DATABASE_ADMIN_URL not set — skipping migrations"
fi
echo "▶ Building Next.js"
npx next build
