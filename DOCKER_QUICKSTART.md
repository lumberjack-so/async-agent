# 🚀 Docker Quick Start Guide

## What Was Done

Your async-agent is now fully containerized with:

✅ **Dockerfile** - Multi-stage build (optimized for production)
✅ **docker-compose.yml** - Complete stack (App + PostgreSQL)
✅ **docker-entrypoint.sh** - Auto database setup & migrations
✅ **Local file storage** - No Supabase needed
✅ **Health checks** - Built-in monitoring
✅ **.env template** - Pre-configured with defaults

## How to Start

### Step 1: Set Your API Key

Edit the `.env` file and replace the placeholder:

```bash
nano .env
```

Change this line:
```bash
ANTHROPIC_API_KEY=sk-ant-REPLACE-WITH-YOUR-ACTUAL-API-KEY
```

To your real API key from https://console.anthropic.com/

### Step 2: Start Everything

```bash
docker-compose up -d
```

This will:
- ✅ Start PostgreSQL database
- ✅ Wait for database to be ready
- ✅ Run all Prisma migrations
- ✅ Start the async-agent server
- ✅ All on port 3001

### Step 3: Verify It's Running

```bash
# Check health
curl http://localhost:3001/health

# Test the agent
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is 2+2? Please explain your answer.",
    "requestId": "test-123"
  }'
```

## What You Get

### Services Running

1. **async-agent-app** (port 3001)
   - Agent execution endpoint
   - File storage at `/app/storage/files`
   - Prisma database connection

2. **async-agent-db** (port 5432)
   - PostgreSQL 15
   - Auto-initialized schema
   - Persistent data volume

### Persistent Data

Everything is saved across restarts:
- **postgres_data** volume → All skills, connections, executions
- **file_storage** volume → All generated files

### File Storage

Files are stored locally and accessible at:
```
http://localhost:3001/files/{requestId}/{timestamp}-{filename}
```

No Supabase required!

## Common Commands

```bash
# View logs
docker-compose logs -f

# Just app logs
docker-compose logs -f app

# Just database logs
docker-compose logs -f postgres

# Stop services (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Restart services
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# Delete EVERYTHING including data
docker-compose down -v
```

## Troubleshooting

### "ANTHROPIC_API_KEY is required"

You forgot to edit `.env` with your real API key.

```bash
nano .env  # Add your API key
docker-compose restart app
```

### Port 3001 already in use

Change the port in `.env`:

```bash
PORT=3002
```

Then restart:

```bash
docker-compose down
docker-compose up -d
```

### Database connection errors

Wait 30 seconds for the database to fully initialize, then check:

```bash
docker-compose logs postgres
```

### View what's in the database

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U asyncagent -d async_agent

# View tables
\dt

# View skills
SELECT id, name, "triggerType" FROM skills;

# Exit
\q
```

## Architecture

```
┌─────────────────────────────────────┐
│  YOUR MACHINE                       │
│  Port 3001                          │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  async-agent-app              │ │
│  │  • Agent execution            │ │
│  │  • File storage (local)       │ │
│  │  • /webhook endpoint          │ │
│  └───────────┬───────────────────┘ │
│              │                      │
│              ▼                      │
│  ┌───────────────────────────────┐ │
│  │  async-agent-db (PostgreSQL)  │ │
│  │  • Skills & Connections       │ │
│  │  • Encrypted credentials      │ │
│  │  • Execution history          │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Next Steps

1. ✅ Your async-agent is ready to use!
2. 📖 See [README.docker.md](README.docker.md) for advanced configuration
3. 🔧 See [README.md](README.md) for API documentation
4. 💾 Set up regular database backups (see README.docker.md)

## Production Deployment

For production, you'll want to:

- [ ] Use proper secrets management (not .env files)
- [ ] Add HTTPS with reverse proxy (nginx/Caddy)
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation
- [ ] Set up automated backups
- [ ] Use stronger database password
- [ ] Restrict CORS origins

See README.docker.md for complete production deployment guide.

---

**Ready to go? Just run:** `docker-compose up -d` 🚀
