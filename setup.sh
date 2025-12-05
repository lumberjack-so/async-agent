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

echo "1️⃣  Starting Docker services (PostgreSQL + Async Agent)..."
docker-compose up -d --build

echo ""
echo "2️⃣  Installing dependencies..."
npm install

echo ""
echo "3️⃣  Linking Alfred CLI globally..."
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
