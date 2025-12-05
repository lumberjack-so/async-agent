#!/bin/bash
set -e

echo "🚀 Setting up Async Agent + Alfred CLI..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env file with your configuration:"
    echo "  cp .env.docker.example .env"
    echo "  Then edit .env and set your ANTHROPIC_API_KEY"
    exit 1
fi

# Check if ANTHROPIC_API_KEY is set
if grep -q "sk-ant-REPLACE-WITH-YOUR-ACTUAL-API-KEY" .env; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY in .env still has placeholder value"
    echo "Please edit .env and set your actual API key"
    exit 1
fi

echo "1️⃣  Configuring environment..."
# Add DATABASE_URL to .env if not present (needed for CLI)
if ! grep -q "^DATABASE_URL=" .env; then
    echo "Adding DATABASE_URL to .env for CLI access..."
    # Read POSTGRES_PASSWORD from .env or use default
    POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env | cut -d '=' -f2 || echo "changeme123")
    echo "" >> .env
    echo "# Database URL for CLI (connects to Docker PostgreSQL on localhost:5432)" >> .env
    echo "DATABASE_URL=postgresql://asyncagent:${POSTGRES_PASSWORD}@localhost:5432/async_agent?schema=public&connection_limit=5" >> .env
fi

echo ""
echo "2️⃣  Starting Docker services (PostgreSQL + Async Agent)..."
docker-compose up -d --build

echo ""
echo "3️⃣  Installing dependencies..."
npm install

echo ""
echo "4️⃣  Linking Alfred CLI globally..."
npm link

echo ""
echo "✅ Setup complete!"
echo ""
echo "Try these commands:"
echo "  alfred --help        # Show CLI help"
echo "  alfred health        # Check server health"
echo "  alfred skills list   # List all skills"
echo ""
echo "Server URLs:"
echo "  API: http://localhost:3001"
echo "  Health: http://localhost:3001/health"
echo ""
