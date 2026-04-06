#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────────
# Docker Entrypoint — runs migrations + seed before starting the API server.
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "⏳ Waiting for database to be ready..."
# The healthcheck in compose handles this, but belt-and-suspenders:
sleep 2

echo "📦 Running database migrations..."
npx prisma migrate deploy

echo "🌱 Seeding database..."
npx prisma db seed || echo "⚠️  Seed skipped (may already exist)"

echo "🚀 Starting the API server..."
exec node dist/server.js
