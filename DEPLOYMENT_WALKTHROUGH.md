# 🚀 Async Agent - Deployment & Usage Walkthrough

## Part 1: What Happens During Deployment

### Step-by-Step Deployment Process

When you run `docker-compose up -d`, here's **exactly** what happens:

---

### **Phase 1: Docker Compose Initialization** (0-5 seconds)

```bash
$ docker-compose up -d
```

**What Docker Compose does:**

1. **Reads `docker-compose.yml`**
   - Finds 2 services: `postgres` and `app`
   - Finds 2 volumes: `postgres_data` and `file_storage`
   - Finds 1 network: `async-agent-network`

2. **Creates Docker network**
   ```
   Creating network "async-agent_async-agent-network"
   ```

3. **Creates persistent volumes**
   ```
   Creating volume "async-agent_postgres_data"
   Creating volume "async-agent_file_storage"
   ```

---

### **Phase 2: PostgreSQL Startup** (5-15 seconds)

```bash
Creating async-agent-db ... done
```

**What happens inside the PostgreSQL container:**

1. **Container starts**
   - Image: `postgres:15-alpine`
   - Exposes port: `5432`
   - Environment:
     - `POSTGRES_USER=asyncagent`
     - `POSTGRES_PASSWORD=<from .env>`
     - `POSTGRES_DB=async_agent`

2. **PostgreSQL initializes database**
   ```
   PostgreSQL Database directory appears to contain a database; Skipping initialization

   OR (first time):

   PostgreSQL init process complete; ready for start up.
   database system is ready to accept connections
   ```

3. **Health check runs**
   ```bash
   # Every 10 seconds:
   pg_isready -U asyncagent
   # Output: /var/run/postgresql:5432 - accepting connections
   ```

4. **Status: HEALTHY**
   - Green checkmark in `docker-compose ps`
   - Ready to accept connections

---

### **Phase 3: App Container Build/Start** (5-30 seconds)

```bash
Creating async-agent-app ... done
```

**What happens:**

1. **Docker waits for PostgreSQL health check**
   ```yaml
   depends_on:
     postgres:
       condition: service_healthy  # ← Waits here
   ```

2. **App container starts**
   - Image: `async-agent:latest` (or builds from Dockerfile)
   - Port: `3001:3001`
   - Volumes mounted:
     - `file_storage:/app/storage/files`
     - `./prompts:/app/prompts:ro`

3. **Environment variables injected**
   ```
   DATABASE_URL=postgresql://asyncagent:password@postgres:5432/async_agent?schema=public&connection_limit=5
   ANTHROPIC_API_KEY=sk-ant-...
   AGENT_MODEL=claude-haiku-4-5
   PORT=3001
   NODE_ENV=production
   LOCAL_STORAGE_PATH=/app/storage/files
   ```

---

### **Phase 4: Entrypoint Script Execution** (`docker-entrypoint.sh`)

This is where the **magic** happens. The entrypoint script runs automatically:

#### **Step 1: Check Required Environment Variables**

```bash
[Entrypoint] ========================================
[Entrypoint]   Async Agent - Starting Container
[Entrypoint] ========================================
```

**Validates:**
```bash
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY environment variable is required!"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is required!"
  exit 1
fi
```

**Output:**
```
[Entrypoint] ✓ Required environment variables are set
```

---

#### **Step 2: Wait for PostgreSQL**

```bash
[Entrypoint] Waiting for PostgreSQL to be ready...
```

**What it does:**
- Runs `npx prisma db execute --stdin <<< "SELECT 1;"`
- Retries every 2 seconds
- Max attempts: 30 (60 seconds total)

**Output:**
```
[Entrypoint] PostgreSQL not ready yet (attempt 1/30)...
[Entrypoint] PostgreSQL not ready yet (attempt 2/30)...
[Entrypoint] ✓ PostgreSQL is ready!
```

---

#### **Step 3: Verify Prisma Client**

```bash
[Entrypoint] Verifying Prisma Client...
```

**Checks if Prisma Client exists:**
```bash
if [ ! -d "node_modules/@prisma/client" ]; then
  echo "⚠ Prisma Client not found, generating..."
  npx prisma generate
fi
```

**Output:**
```
[Entrypoint] ✓ Prisma Client found!
```

---

#### **Step 4: Run Database Migrations** 🔥

```bash
[Entrypoint] Running Prisma migrations...
```

**Runs:**
```bash
npx prisma migrate deploy
```

**What this does:**
- Reads `prisma/migrations/` directory
- Applies any pending migrations
- Creates tables if they don't exist:
  - `connections` (MCP servers + credentials)
  - `skills` (user workflows)
  - `executions` (execution history)
  - `config` (encrypted secrets)
  - `_prisma_migrations` (migration tracking)

**Output:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "async_agent"

1 migration found in prisma/migrations

Applying migration `20241204_foundation_schema`

The following migration(s) have been applied:

migrations/
  └─ 20241204_foundation_schema/
    └─ migration.sql

[Entrypoint] ✓ Migrations completed successfully!
```

**Database is now ready!** ✅

---

#### **Step 5: Create Storage Directory**

```bash
mkdir -p /app/storage/files
```

**Output:**
```
[Entrypoint] ✓ Storage directory ready: /app/storage/files
```

---

#### **Step 6: Start the Server**

```bash
[Entrypoint] ========================================
[Entrypoint]   Async Agent - Ready to Start
[Entrypoint] ========================================
[Entrypoint]   Model: claude-haiku-4-5
[Entrypoint]   Port: 3001
[Entrypoint]   Environment: production
[Entrypoint] ========================================
```

**Executes:**
```bash
exec npm start
```

**Which runs:**
```bash
node dist/index.js
```

---

### **Phase 5: Server Startup** (1-2 seconds)

**Console output:**

```
[Config] Validating configuration...
[Config] Server configuration:
[Config]   - Port: 3001
[Config]   - Environment: production
[Config]   - CORS Origin: *
[Config] Agent configuration:
[Config]   - API Key: SET
[Config]   - Model: claude-haiku-4-5
[Config]   - Timeout: 300s
[Config]   - Disallowed Tools: none
[Config] Workflow configuration:
[Config]   - Agent Model: claude-haiku-4-5
[Config]   - Classifier Model: claude-haiku-4-5
[Config] Database configuration:
[Config]   - URL: SET
[Config] File configuration:
[Config]   - Max Size: 50MB
[Config] Security configuration:
[Config]   - Rate Limit: 60 requests per 60s
[Config] MCP configuration:
[Config]   - Servers: none
[Config] ✓ Configuration validation passed
[Config] ========================================

[Server] Async agent server listening on port 3001
[Server] Environment: production
[Server] Health check: http://localhost:3001/health
[Server] Metrics: http://localhost:3001/metrics
[Server] Webhook: POST http://localhost:3001/webhook
```

---

### **Phase 6: Health Checks Pass** ✅

**Docker health check runs:**
```bash
curl -f http://localhost:3001/health || exit 1
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": "0h 0m 5s",
  "timestamp": "2025-12-05T10:30:00.000Z",
  "database": "connected",
  "metrics": {
    "requests": { "total": 0, "successful": 0, "failed": 0 },
    "avgDuration": 0,
    "filesGenerated": 0,
    "filesUploaded": 0,
    "errors": {}
  }
}
```

---

### **🎉 Deployment Complete!**

**Status check:**
```bash
$ docker-compose ps
```

**Output:**
```
NAME                   STATUS              PORTS
async-agent-app        Up (healthy)        0.0.0.0:3001->3001/tcp
async-agent-db         Up (healthy)        0.0.0.0:5432->5432/tcp
```

**Total time:** ~20-60 seconds (first run), ~5-10 seconds (subsequent runs)

---

## Part 2: How to Use the Deployed System

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Your Machine (localhost)                                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Docker Compose Network                                │ │
│  │                                                          │ │
│  │  ┌──────────────────────┐    ┌─────────────────────┐  │ │
│  │  │  async-agent-app     │    │  async-agent-db     │  │ │
│  │  │  (Node 23)           │◄───│  (PostgreSQL 15)    │  │ │
│  │  │  Port: 3001          │    │  Port: 5432         │  │ │
│  │  │                      │    │                     │  │ │
│  │  │  API Endpoints:      │    │  Tables:            │  │ │
│  │  │  • POST /webhook     │    │  • connections      │  │ │
│  │  │  • GET /health       │    │  • skills           │  │ │
│  │  │  • GET /metrics      │    │  • executions       │  │ │
│  │  │  • GET /files/*      │    │  • config           │  │ │
│  │  └──────────┬───────────┘    └─────────────────────┘  │ │
│  │             │                                           │ │
│  │             ▼                                           │ │
│  │  ┌──────────────────────┐                              │ │
│  │  │  File Storage        │                              │ │
│  │  │  /app/storage/files  │                              │ │
│  │  │  (Docker Volume)     │                              │ │
│  │  └──────────────────────┘                              │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### Use Case 1: Execute a Simple Prompt

**What you want:** Ask the agent to do something

**How to do it:**

```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the capital of France? Explain why.",
    "requestId": "test-1"
  }'
```

**What happens:**

1. **Request received** → Logged with correlation ID
2. **Validation** → Zod schema validates request
3. **System prompt loaded** → From `prompts/system.md` or env var
4. **Agent execution** → Claude Agent SDK runs with prompt
5. **File detection** → Checks if agent created any files
6. **File storage** → Copies files to `/app/storage/files/test-1/`
7. **Response returned** → JSON with answer + file URLs

**Response:**

```json
{
  "response": "The capital of France is Paris. Paris became the capital in 508 CE...",
  "files": [],
  "requestId": "test-1",
  "trace": [
    {
      "role": "user",
      "content": "What is the capital of France? Explain why."
    },
    {
      "role": "assistant",
      "content": "The capital of France is Paris..."
    }
  ]
}
```

---

### Use Case 2: Generate Files

**What you want:** Agent creates a file and you get the URL

**Example:**

```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a JSON file with the top 5 programming languages and save it as languages.json",
    "requestId": "file-test-1"
  }'
```

**What happens:**

1. Agent creates `/tmp/<working-dir>/languages.json`
2. System detects file in working directory
3. System copies file to `/app/storage/files/file-test-1/1733394000-languages.json`
4. System generates URL: `http://localhost:3001/files/file-test-1/1733394000-languages.json`
5. System appends file info to response

**Response:**

```json
{
  "response": "I've created a JSON file with the top 5 programming languages...\n\n--- Files Generated ---\n1. languages.json\n   URL: http://localhost:3001/files/file-test-1/1733394000-languages.json",
  "files": [
    {
      "name": "languages.json",
      "url": "http://localhost:3001/files/file-test-1/1733394000-languages.json"
    }
  ],
  "requestId": "file-test-1",
  "trace": [...]
}
```

**Download the file:**

```bash
curl http://localhost:3001/files/file-test-1/1733394000-languages.json
```

**Output:**
```json
{
  "languages": [
    "Python",
    "JavaScript",
    "Java",
    "C++",
    "Go"
  ]
}
```

---

### Use Case 3: Async Execution (Fire and Forget)

**What you want:** Start a long-running task and check status later

**Request:**

```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Research the history of AI and create a detailed report",
    "requestId": "async-research-1",
    "async": true
  }'
```

**Immediate response (HTTP 202):**

```json
{
  "status": "processing",
  "requestId": "async-research-1"
}
```

**Check status:**

```bash
# View logs
docker-compose logs -f app | grep async-research-1

# Check metrics
curl http://localhost:3001/metrics
```

---

### Use Case 4: Working with Skills (Multi-Step Workflows)

Skills are stored in the Prisma database and define multi-step workflows.

#### **Create a Skill via Database**

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U asyncagent -d async_agent

# Insert a skill
INSERT INTO skills (id, name, description, trigger_type, steps, connection_names, is_active)
VALUES (
  gen_random_uuid(),
  'Daily Summary',
  'Generate a daily summary report',
  'manual',
  '[
    {
      "id": 1,
      "prompt": "Analyze recent activity",
      "guidance": "Focus on key metrics",
      "allowedTools": []
    },
    {
      "id": 2,
      "prompt": "Create summary report",
      "guidance": "Make it concise",
      "allowedTools": []
    }
  ]'::jsonb,
  ARRAY[]::text[],
  true
);
```

#### **Execute a Skill**

```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate my daily summary",
    "requestId": "skill-test-1",
    "searchWorkflow": true
  }'
```

**What happens:**

1. **Classifier runs** → Uses Claude to match prompt to skill
2. **Skill matched** → "Daily Summary" skill found
3. **Orchestrator executes** → Runs each step in sequence
4. **Step 1:** Analyzes activity (creates new session)
5. **Step 2:** Creates summary (forks from Step 1 session)
6. **Synthesis:** Combines all outputs into final response
7. **Response returned** → Complete summary with traces

---

### Use Case 5: Adding MCP Connections

MCP (Model Context Protocol) connections give the agent tools.

#### **Option A: Via Environment Variable**

Edit `.env`:

```bash
MCP_CONNECTIONS={"filesystem":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/workspace"]}}
```

Restart:
```bash
docker-compose restart app
```

#### **Option B: Via Database**

```bash
docker-compose exec postgres psql -U asyncagent -d async_agent
```

```sql
INSERT INTO connections (id, name, type, config, tools, is_active)
VALUES (
  gen_random_uuid(),
  'GitHub',
  'mcp_stdio',
  '{
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "encrypted:your-token-here"
    }
  }'::jsonb,
  ARRAY['github__create_issue', 'github__search_repos'],
  true
);
```

**Now agent has GitHub tools!**

---

### Use Case 6: Monitoring & Observability

#### **Health Check**

```bash
curl http://localhost:3001/health
```

```json
{
  "status": "healthy",
  "uptime": "2h 15m 30s",
  "timestamp": "2025-12-05T12:45:30.000Z",
  "database": "connected",
  "metrics": {
    "requests": {
      "total": 47,
      "successful": 45,
      "failed": 2
    },
    "avgDuration": 2.3,
    "filesGenerated": 12,
    "filesUploaded": 12,
    "errors": {
      "AgentError": 2
    }
  }
}
```

#### **Metrics Endpoint**

```bash
curl http://localhost:3001/metrics
```

```json
{
  "timestamp": "2025-12-05T12:45:30.000Z",
  "requests": {
    "total": 47,
    "successful": 45,
    "failed": 2,
    "successRate": 95.74
  },
  "avgDuration": 2.3,
  "filesGenerated": 12,
  "filesUploaded": 12,
  "errors": {
    "AgentError": 2,
    "ValidationError": 0
  },
  "uptime": 8130
}
```

#### **View Logs**

```bash
# All logs
docker-compose logs -f

# Just app logs
docker-compose logs -f app

# Just database logs
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 app

# Follow specific request
docker-compose logs -f app | grep "test-1"
```

---

### Use Case 7: Database Operations

#### **View All Skills**

```bash
docker-compose exec postgres psql -U asyncagent -d async_agent -c "SELECT id, name, trigger_type, run_count FROM skills;"
```

#### **View Execution History**

```bash
docker-compose exec postgres psql -U asyncagent -d async_agent -c "SELECT id, status, trigger, started_at, duration_ms FROM executions ORDER BY started_at DESC LIMIT 10;"
```

#### **View Connections**

```bash
docker-compose exec postgres psql -U asyncagent -d async_agent -c "SELECT name, type, is_active, tools FROM connections;"
```

#### **Interactive SQL**

```bash
docker-compose exec postgres psql -U asyncagent -d async_agent

async_agent=# \dt
# List all tables

async_agent=# SELECT * FROM skills WHERE is_active = true;
# Query skills

async_agent=# \q
# Exit
```

---

### Use Case 8: Backup & Restore

#### **Backup Database**

```bash
docker-compose exec -T postgres pg_dump -U asyncagent async_agent > backup.sql
```

#### **Backup Files**

```bash
docker run --rm \
  -v async-agent_file_storage:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/files-backup.tar.gz -C /data .
```

#### **Restore Database**

```bash
cat backup.sql | docker-compose exec -T postgres psql -U asyncagent async_agent
```

---

## Part 3: Common Workflows

### Workflow 1: Development Cycle

```bash
# 1. Make code changes
nano src/database.ts

# 2. Rebuild
npm run build

# 3. Rebuild Docker image
docker-compose build app

# 4. Restart
docker-compose up -d

# 5. Test
curl http://localhost:3001/health
```

### Workflow 2: Production Deployment

```bash
# 1. Clone repo on server
git clone <repo> /opt/async-agent
cd /opt/async-agent

# 2. Configure
cp .env.docker.example .env
nano .env  # Set ANTHROPIC_API_KEY

# 3. Deploy
docker-compose up -d

# 4. Verify
docker-compose ps
docker-compose logs app

# 5. Test
curl http://localhost:3001/health
```

### Workflow 3: Scaling

```bash
# Run multiple app instances
docker-compose up -d --scale app=3

# Use nginx for load balancing
# (nginx config not included, but standard setup)
```

---

## Part 4: Troubleshooting

### Problem: Container won't start

```bash
# Check logs
docker-compose logs app

# Common issues:
# - ANTHROPIC_API_KEY not set → Edit .env
# - DATABASE_URL wrong → Check docker-compose.yml
# - Port 3001 in use → Change PORT in .env
```

### Problem: Database connection failed

```bash
# Check database status
docker-compose ps postgres

# Restart database
docker-compose restart postgres

# Wait 30 seconds, then restart app
docker-compose restart app
```

### Problem: Files not uploading

```bash
# Check storage directory
docker-compose exec app ls -la /app/storage/files

# Check permissions
docker-compose exec app chown -R node:node /app/storage
```

---

## Summary: Your Deployed System

**What you have:**
- ✅ Agent API on port 3001
- ✅ PostgreSQL database with Prisma
- ✅ Local file storage (persistent)
- ✅ Health checks & metrics
- ✅ Auto-migration on startup
- ✅ Production-ready logging

**What you can do:**
- ✅ Execute prompts via `/webhook`
- ✅ Create multi-step skills
- ✅ Add MCP tools
- ✅ Store execution history
- ✅ Generate & serve files
- ✅ Monitor with `/health` and `/metrics`

**It's that simple!** 🚀
