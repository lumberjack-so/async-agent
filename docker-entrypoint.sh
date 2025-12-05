#!/bin/bash
set -e

echo "========================================="
echo "  Async Agent - Starting Container"
echo "========================================="

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
  echo "[Entrypoint] Waiting for PostgreSQL to be ready..."

  local max_attempts=30
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
      echo "[Entrypoint] ✓ PostgreSQL is ready!"
      return 0
    fi

    echo "[Entrypoint] PostgreSQL not ready yet (attempt $attempt/$max_attempts)..."
    sleep 2
    attempt=$((attempt + 1))
  done

  echo "[Entrypoint] ✗ ERROR: PostgreSQL failed to become ready after $max_attempts attempts"
  exit 1
}

# Function to run database migrations
run_migrations() {
  echo "[Entrypoint] Running Prisma migrations..."

  if npx prisma migrate deploy; then
    echo "[Entrypoint] ✓ Migrations completed successfully!"
  else
    echo "[Entrypoint] ✗ ERROR: Migrations failed!"
    exit 1
  fi
}

# Function to seed default skills
seed_default_skills() {
  echo "[Entrypoint] Checking for default skills..."

  # Check if any skills exist
  local skill_count=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM skills;" 2>/dev/null | tail -n 1 | tr -d ' ')

  if [ "$skill_count" = "0" ] || [ -z "$skill_count" ]; then
    echo "[Entrypoint] No skills found, seeding default skills..."

    if [ -f "/app/scripts/seed-christmas-skill.sql" ]; then
      if npx prisma db execute --stdin < /app/scripts/seed-christmas-skill.sql; then
        echo "[Entrypoint] ✓ Default skills seeded successfully!"
      else
        echo "[Entrypoint] ⚠ Warning: Failed to seed default skills (non-fatal)"
      fi
    else
      echo "[Entrypoint] ⚠ Warning: Seed file not found (non-fatal)"
    fi
  else
    echo "[Entrypoint] ✓ Skills already exist ($skill_count found), skipping seed"
  fi
}

# Function to verify Prisma client
verify_prisma_client() {
  echo "[Entrypoint] Verifying Prisma Client..."

  if [ ! -d "node_modules/@prisma/client" ]; then
    echo "[Entrypoint] ⚠ Prisma Client not found, generating..."
    npx prisma generate
  else
    echo "[Entrypoint] ✓ Prisma Client found!"
  fi
}

# Main entrypoint logic
main() {
  # Check required environment variables
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "[Entrypoint] ✗ ERROR: ANTHROPIC_API_KEY environment variable is required!"
    echo "[Entrypoint] Please set it in your .env file or docker-compose.yml"
    exit 1
  fi

  if [ -z "$DATABASE_URL" ]; then
    echo "[Entrypoint] ✗ ERROR: DATABASE_URL environment variable is required!"
    exit 1
  fi

  echo "[Entrypoint] ✓ Required environment variables are set"

  # Wait for PostgreSQL
  wait_for_postgres

  # Verify Prisma Client
  verify_prisma_client

  # Run migrations
  run_migrations

  # Seed default skills (only if database is empty)
  seed_default_skills

  # Create storage directory if it doesn't exist
  mkdir -p "${LOCAL_STORAGE_PATH:-/app/storage/files}"
  echo "[Entrypoint] ✓ Storage directory ready: ${LOCAL_STORAGE_PATH:-/app/storage/files}"

  echo ""
  echo "========================================="
  echo "  Async Agent - Ready to Start"
  echo "========================================="
  echo "  Model: ${AGENT_MODEL:-claude-sonnet-4-20250514}"
  echo "  Port: ${PORT:-3001}"
  echo "  Environment: ${NODE_ENV:-production}"
  echo "========================================="
  echo ""

  # Execute the main command (npm start)
  exec "$@"
}

# Run main function
main "$@"
