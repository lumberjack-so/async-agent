# Async Agent

A generic async agent server using Claude Agent SDK with dynamic MCP connections.

## Features

- **Claude Agent SDK Integration**: Execute prompts with full agent capabilities
- **Dynamic MCP Connections**: MCP server configurations are provided per-request via middleware
- **Async Execution**: Support for both synchronous and asynchronous request processing
- **Local File Storage**: Automatic detection and storage of generated files
- **Prisma Database**: PostgreSQL database with encrypted credentials and execution history
- **Production Ready**: Rate limiting, security headers, error handling, logging, metrics
- **Docker Support**: One-command containerized deployment with PostgreSQL

## Quick Start

### 🐳 Docker (Recommended)

The easiest way to get started:

```bash
# Copy Docker environment template
cp .env.docker.example .env

# Edit .env and set your ANTHROPIC_API_KEY
nano .env

# Start everything (app + PostgreSQL)
docker-compose up -d

# Test it
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?", "requestId": "test-1"}'
```

**Default Skills**: On first run, the database is automatically seeded with example workflows (like "Christmas Present Finder"). See `scripts/` directory for available skills.

**See [README.docker.md](README.docker.md) for complete Docker documentation.**

## Alfred CLI

Alfred is a command-line interface for managing your async agent system. It provides an easy way to manage skills, configure models, and send tasks directly from your terminal.

### Installation

The CLI is built into the project and uses the same database as the async-agent server.

```bash
# Build the project (includes CLI)
npm run build

# The CLI is now available as 'alfred' command via npm
# You can run it directly:
node dist/cli/index.js --help

# Or install globally:
npm link
alfred --help
```

### CLI Commands

#### Skills Management

```bash
# List all skills
alfred skills list
alfred skills list --active
alfred skills list --json

# View skill details
alfred skills view <skill-id>
alfred skills view <skill-id> --json

# Create new skill (interactive TUI)
alfred skills create

# Edit existing skill (interactive TUI)
alfred skills edit <skill-id>

# Delete skill
alfred skills delete <skill-id>
alfred skills delete <skill-id> --yes  # Skip confirmation
```

#### Model Configuration

```bash
# Get current model
alfred config model get

# Set model
alfred config model set claude-sonnet-4-5-20251022
```

Available models:
- `claude-haiku-4-5-20251001` (fast, cost-effective)
- `claude-sonnet-4-5-20251022` (balanced, recommended)
- `claude-opus-4-5-20251101` (most capable)

#### Task Execution

```bash
# Send task to alfred (sync)
alfred run "What is 2+2?"

# Async execution
alfred run "Deploy my app" --async

# Specify execution mode
alfred run "Find me a Christmas present for John" --mode orchestrator
alfred run "Calculate pi to 10 digits" --mode default

# With custom request ID
alfred run "Hello" --request-id my-custom-id

# With metadata (JSON string)
alfred run "Test" --metadata '{"source":"cli","priority":"high"}'

# JSON output
alfred run "Test" --json
```

#### System Health

```bash
# Check server health
alfred health
alfred health --json
```

#### Version Info

```bash
# Show version
alfred version
```

### CLI Environment Setup

The CLI requires a `.env` file in the project root with at least:

```bash
DATABASE_URL=postgresql://asyncagent:changeme123@localhost:5432/async_agent
ANTHROPIC_API_KEY=sk-ant-your-api-key
```

The CLI connects to your local PostgreSQL database (exposed on port 5432 by Docker Compose).

### Interactive Skill Builder

The `alfred skills create` and `alfred skills edit` commands launch an interactive TUI (Terminal User Interface) that guides you through:

1. **Basic Info**: Name, description, trigger type, connections
2. **Add Steps**: Define each step with prompts, guidance, allowed tools
3. **Review**: Confirm before saving

Navigation:
- Use **Tab** or **Enter** to move between fields
- Press **Enter** to continue to next screen
- Press **Ctrl+C** to cancel at any time

### 📦 Manual Setup

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
# At minimum, set ANTHROPIC_API_KEY and DATABASE_URL

# Setup database
npx prisma migrate deploy
npx prisma generate

# Run in development mode
npm run dev

# Or build and run production
npm run build
npm start
```

## Breaking Changes

### API v2 - Unified Execution Modes

**What Changed:**
- The `searchWorkflow` boolean parameter has been removed
- New `mode` parameter controls execution behavior
- Consolidated to single `AGENT_MODEL` for all operations
- Removed `WORKFLOW_AGENT_MODEL` and `CLASSIFIER_MODEL` environment variables

**Migration Guide:**

Old API (v1):
```json
{
  "prompt": "deploy my app",
  "searchWorkflow": true
}
```

New API (v2):
```json
{
  "prompt": "deploy my app",
  "mode": "orchestrator"
}
```

**Mode Mapping:**
- `searchWorkflow: true` → `mode: "orchestrator"` (classify then execute)
- `searchWorkflow: false` → `mode: "default"` (skip classification)
- New: `mode: "classifier"` (only classify, don't execute)

**Environment Variables:**
- Remove: `WORKFLOW_AGENT_MODEL`, `CLASSIFIER_MODEL`
- Keep: `AGENT_MODEL` (now used for all operations)

**Response Changes:**
- Added `classification` field (present for classifier/orchestrator modes)
- `workflowId` and `workflow` only present when workflow was executed
- Removed `trace` field from response (traces are internal only)

## API Endpoints

### POST /webhook (or /webhooks/prompt)

Execute a prompt through the agent.

**Request Body:**
```json
{
  "prompt": "Your prompt here",
  "requestId": "optional-request-id",
  "systemPrompt": "optional system prompt override",
  "mode": "default",
  "async": false,
  "metadata": {}
}
```

**Execution Modes:**
- `classifier` - Only classify the prompt, return workflow match info (no execution)
- `orchestrator` - Classify and execute workflow if match found, fallback to default agent
- `default` - Skip classification, execute as regular one-off agent (default if omitted)

**Response:**
```json
{
  "response": "Agent's response",
  "files": [
    { "name": "file.txt", "url": "https://..." }
  ],
  "requestId": "req-123",
  "classification": {
    "workflowId": "skill-123",
    "confidence": "high",
    "reasoning": "Matched deployment workflow"
  },
  "workflowId": "skill-123",
  "workflow": {
    "id": "skill-123",
    "name": "Deploy Application",
    "steps": [...]
  }
}
```

**Response fields:**
- `classification` - Present for `classifier` and `orchestrator` modes
- `workflowId`, `workflow` - Present only if workflow was executed

### GET /health

Health check endpoint.

### GET /metrics

Server metrics endpoint.

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key |
| `PORT` | No | 3001 | Server port |
| `AGENT_MODEL` | No | claude-haiku-4-5 | Claude model to use |
| `AGENT_TIMEOUT_MS` | No | 300000 | Agent execution timeout (ms) |
| `LOCAL_STORAGE_PATH` | No | ./storage/files | Local file storage directory |
| `MCP_CONNECTIONS` | No | {} | JSON-encoded MCP server configurations |

See `.env.example` for all options.

### Database Client

Async Agent uses a Prisma-based database client with connection pooling optimized for single-tenant VM workloads.

#### Connection Pool Settings

- **Pool Size**: 5 connections (single-tenant, lower concurrency)
- **Connection Timeout**: 5 seconds
- **Query Timeout**: 15 seconds (allows for complex workflow queries)

#### Database Configuration

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/async_agent?schema=public&connection_limit=5"
```

#### Usage Examples

**Basic Usage:**

```typescript
import prisma from './src/db/client';

// Query skills
const skills = await prisma.skill.findMany({
  where: { isActive: true },
});

// Get skill with connections
const skill = await prisma.skill.findUnique({
  where: { id: skillId },
  include: { connections: true },
});
```

**Health Check:**

```typescript
import { healthCheck } from './src/db/client';

const isHealthy = await healthCheck();
```

**Transactions for Skill Execution:**

```typescript
import { transaction } from './src/db/client';

const execution = await transaction(async (tx) => {
  // Create execution record
  const exec = await tx.execution.create({
    data: {
      skillId,
      status: 'running',
      trigger: 'manual',
    },
  });

  // Update skill metadata
  await tx.skill.update({
    where: { id: skillId },
    data: {
      runCount: { increment: 1 },
      lastRunAt: new Date(),
    },
  });

  return exec;
});
```

**Skill Execution Helpers:**

```typescript
import { createSkillExecution, completeSkillExecution } from './src/db/utils';

// Start execution (atomic with skill update)
const execution = await createSkillExecution('skill-123', {
  trigger: 'webhook',
  input: { data: 'test' },
});

// Complete execution
await completeSkillExecution(execution.id, {
  status: 'completed',
  output: 'Success',
  trace: { steps: [] },
  durationMs: 1500,
  tokenCount: 250,
  costUsd: 0.01,
});
```

#### Database Schema

The Prisma schema is located at `prisma/schema.prisma`. Key entities:

- **Connection** - MCP connections with encrypted credentials
- **Skill** - User workflows with steps and trigger configuration
- **Execution** - Full execution history with traces
- **Config** - Encrypted key-value store for VM secrets

#### Migrations

Apply database migrations:

```bash
npx prisma migrate deploy
```

Generate Prisma client after schema changes:

```bash
npx prisma generate
```

### Prompts

System and user prompts can be configured via:

1. **Environment variables**: `SYSTEM_PROMPT`, `USER_PROMPT_PREFIX`
2. **Files**: `prompts/system.md`, `prompts/user.md`

## MCP Connections

The key feature of this server is **dynamic MCP connections**. Instead of hardcoding MCP server configurations, they're provided per-request via the connections middleware.

### Default: Environment Variable

By default, MCP connections are loaded from the `MCP_CONNECTIONS` environment variable:

```bash
MCP_CONNECTIONS='{"my-server":{"command":"node","args":["server.js"]}}'
```

### Custom: Implement Your Own Middleware

For dynamic connections (e.g., per-tenant, per-user), replace the middleware in `src/index.ts`:

```typescript
import { connectionsMiddleware } from './middleware/connections.js';

// Replace this:
app.use(createEnvConnectionsMiddleware());

// With your custom middleware:
app.use(async (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  const connections = await myConnectionService.getConnections(tenantId);
  req.mcpConnections = connections;
  next();
});
```

### MCP Connection Format

```typescript
interface McpServerConfig {
  command: string;      // Command to start the MCP server
  args: string[];       // Command arguments
  env?: Record<string, string>;  // Environment variables
}

interface McpConnections {
  [serverName: string]: McpServerConfig;
}
```

Example:
```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/dir"]
  },
  "github": {
    "command": "node",
    "args": ["./mcp/github-server.js"],
    "env": {
      "GITHUB_TOKEN": "ghp_..."
    }
  }
}
```

## Project Structure

```
async-agent/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── webhook.ts            # Webhook handler
│   ├── agent.ts              # Claude Agent SDK integration
│   ├── types.ts              # TypeScript types
│   ├── validation.ts         # Request validation (Zod)
│   ├── database.ts           # Prisma database operations
│   ├── files.ts              # File detection and local storage
│   ├── prompts.ts            # Prompt loading
│   ├── middleware/
│   │   ├── connections.ts    # MCP connections middleware
│   │   ├── logging.ts        # Request logging
│   │   ├── timeout.ts        # Request timeout
│   │   ├── security.ts       # Security validation
│   │   └── error-handler.ts  # Error handling
│   └── utils/
│       ├── errors.ts         # Custom error classes
│       └── monitoring.ts     # Metrics collection
├── prompts/
│   ├── system.md             # Default system prompt
│   └── user.md               # Default user prompt prefix
├── package.json
├── tsconfig.json
└── .env.example
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Type check without building
npm run typecheck

# Build for production
npm run build

# Run production build
npm start
```

## Database Schema

The Prisma schema is located at `prisma/schema.prisma` and includes:

- **Connection** - MCP connections with encrypted credentials
- **Skill** - User workflows with steps and trigger configuration
- **Execution** - Full execution history with traces
- **Config** - Encrypted key-value store for VM secrets

Apply migrations with:
```bash
npx prisma migrate deploy
npx prisma generate
```

See `README.prisma.md` for complete schema documentation.

## Default Skills

The system comes with pre-built skills that are automatically seeded on first installation:

### Christmas Present Finder
A 5-step workflow that researches a person and recommends the perfect Christmas present:
1. Research person's profile via web search
2. Analyze motivations and values
3. Find top 5 gift options with purchase links
4. Assume their persona to choose the best match
5. Return final recommendation

**Usage:**
```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find the perfect Christmas present for Elon Musk",
    "mode": "orchestrator"
  }'
```

See `scripts/README-christmas-skill.md` for full documentation.

### Adding Your Own Skills

To add custom skills, insert them into the `skills` table:
```bash
# Via SQL
docker-compose exec -T postgres psql -U asyncagent -d async_agent < scripts/your-skill.sql

# Or create via API/Prisma Studio
docker-compose exec app npx prisma studio
```

## File Storage

Generated files are stored locally in `/app/storage/files` (Docker) or `./storage/files` (local).

Files are accessible via HTTP at:
```
http://localhost:3001/files/{requestId}/{timestamp}-{filename}
```

## License

MIT
