# Alfred - Async Agent Execution Engine

## Project Overview

**Alfred** is a sophisticated async agent execution engine that orchestrates multi-step AI workflows using Claude's Agent SDK with dynamic MCP (Model Context Protocol) connections. This is a production-ready system with full Docker support, database persistence, streaming capabilities, and an interactive CLI/TUI interface.

### Key Characteristics
- **Type**: Express.js-based async agent execution engine
- **Language**: TypeScript (100% type-safe)
- **Database**: PostgreSQL with Prisma ORM
- **Agent**: Claude Agent SDK with session forking
- **Deployment**: Docker Compose with single-command setup
- **CLI**: Full-featured "Alfred" command-line tool with TUI mode

## Architecture

### Execution Modes

Alfred supports three execution modes:

1. **One-off Agent Mode**: Direct Claude Agent SDK execution for arbitrary tasks
2. **Workflow Orchestration Mode**: Multi-step workflow execution with session forking
3. **Classification Mode**: Prompt classification to match predefined workflows

### Core Components

```
├── HTTP Server (Express)
│   ├── Middleware Chain (CORS, Security, Rate Limiting, Timeout, Logging)
│   ├── MCP Connections Injection
│   └── Routes (/webhook, /stream, /files, /health, /metrics)
│
├── Execution Engine
│   ├── Agent Executor (Mode Router)
│   ├── Workflow Classifier (Match prompts to skills)
│   ├── Workflow Orchestrator (Multi-step execution)
│   ├── Workflow Agent (Per-step execution with tool restrictions)
│   └── Default Agent (One-off execution)
│
├── Data Layer
│   ├── Prisma ORM
│   └── Models: Skill, Connection, Execution, Config
│
├── CLI/TUI
│   ├── Commander.js (CLI framework)
│   ├── Ink/React (Terminal UI)
│   └── Commands: skills, config, run, health, version
│
└── Integration Points
    ├── Claude Agent SDK (AI execution)
    ├── MCP Servers (Dynamic tool connections)
    └── SSE Streaming (Real-time updates)
```

### Key Design Patterns

- **Facade Pattern**: `agent-executor.ts` unifies three execution modes
- **Factory Pattern**: Middleware and connection builders
- **Singleton Pattern**: Prisma client, metrics collector
- **Strategy Pattern**: Three execution strategies based on mode
- **Session Forking**: Multi-step workflow continuity via Claude SDK

### Database Schema

**Four main models:**

1. **Connection** - MCP server configurations (name, type, config, tools, isActive)
2. **Skill** - User-defined workflows (name, steps, connectionNames, triggerType)
3. **Execution** - Skill execution history (status, input, output, trace, metrics)
4. **Config** - VM configuration KV store (encrypted values)

### MCP Integration

Alfred uses the Model Context Protocol (MCP) to dynamically connect tools:

- **Three-tier tool filtering**: SDK tools → MCP servers → MCP tool names
- **Per-step connections**: Each workflow step can have different tool restrictions
- **Connection resolution**: Step-level overrides skill-level fallback
- **Credential encryption**: Connections stored encrypted in database

## Development Guidelines

### SOLID Principles Applied

- **Single Responsibility**: Each module has one clear purpose
  - `agent-executor.ts` - Mode routing only
  - `workflow-orchestrator.ts` - Multi-step orchestration only
  - `connection-resolver.ts` - MCP connection resolution only

- **Open/Closed**: Extensible via:
  - New execution modes (add to `executeWithMode` switch)
  - New MCP servers (database-driven, no code changes)
  - New CLI commands (plugin architecture)

- **Liskov Substitution**: All executors return `ExecutionResult`

- **Interface Segregation**: Small, focused interfaces
  - `ExecuteOptions` for execution
  - `ClassificationResult` for classifier
  - `McpConnections` for MCP config

- **Dependency Inversion**: Dependencies injected via parameters
  - MCP connections injected via middleware
  - Prompts loaded from files/env
  - Configuration centralized in `config/index.ts`

### DRY Principles Applied

- **Database operations**: Centralized in `src/database.ts` facade
- **File operations**: Reusable utilities in `src/files.ts`
- **Validation**: Shared Zod schemas in `src/validation.ts`
- **Error handling**: Custom error classes in `src/utils/errors.ts`
- **Logging**: Centralized logger in middleware with correlation IDs
- **Prompt loading**: Single source in `src/prompts.ts`

### Type Safety

- Full TypeScript with `strict: true`
- Zod runtime validation at entry points
- Type-safe database operations via Prisma
- Type-safe MCP configuration objects

### Testing

- Jest test framework with ts-jest
- Database client tests
- Schema validation tests
- Coverage reporting enabled

## Key Files Reference

### Entry Points
- `src/index.ts` - Express server initialization
- `src/cli/index.ts` - CLI entry point

### Core Logic
- `src/agent-executor.ts` - Execution mode router
- `src/workflow-orchestrator.ts` - Multi-step workflow execution
- `src/workflow-classifier.ts` - Prompt → skill matching
- `src/connection-resolver.ts` - MCP connection & tool filtering

### Data Access
- `src/database.ts` - Database operations facade
- `src/db/client.ts` - Prisma singleton
- `prisma/schema.prisma` - Database schema

### Configuration
- `src/config/index.ts` - Centralized configuration
- `.env.example` - Environment variable template

### CLI
- `src/cli/commands/` - CLI command implementations
- `src/cli/tui/` - Terminal UI components
- `src/cli/lib/api-client.ts` - HTTP client for server communication

## Extension Points

### Safe to Modify/Extend
- MCP connection configurations (database-driven)
- System/user prompts (file or env var driven)
- New CLI commands (plugin architecture)
- Custom tool filtering logic (`connection-resolver.ts`)
- New metrics and health checks
- New execution modes (extend `agent-executor.ts`)

### Modify with Caution
- Database schema (`prisma/schema.prisma`) - Requires migration
- Core types (`src/types.ts`) - Ripple effects
- Middleware chain (`src/index.ts`) - Changes request flow
- Session management (`workflow-agent.ts`) - Breaks multi-step workflows

## Common Workflows

### Adding a New MCP Server
1. Create MCP server with tool definitions
2. Add connection config to PostgreSQL (via API or directly)
3. Reference in skill `connectionNames` field
4. Connection resolver handles rest automatically

### Adding a New Execution Mode
1. Create new executor function (like `executeAgent`)
2. Add new case in `executeWithMode()` switch
3. Update `ExecutionMode` type
4. Update validation schema

### Adding New CLI Commands
1. Create command file in `src/cli/commands/`
2. Import and register in `src/cli/index.ts`
3. Use api-client and formatters for consistency

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Claude API key

### Optional
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - development|production
- `AGENT_MODEL` - Claude model (default: claude-haiku-4-5)
- `AGENT_TIMEOUT_MS` - Agent timeout (default: 300000)
- `REQUEST_TIMEOUT_MS` - HTTP timeout (default: 360000)
- `DISALLOWED_TOOLS` - Comma-separated tool names to disable
- `MAX_FILE_SIZE_MB` - File upload limit (default: 50)
- `RATE_LIMIT_MAX` - Requests per window (default: 60)
- `MCP_CONNECTIONS` - JSON with MCP server configs

## Deployment

```bash
# One-command setup
./setup.sh

# Or manual Docker Compose
docker-compose up -d --build

# Install CLI globally
npm install -g .
alfred --help
```

## API Endpoints

- `POST /webhook` - Main execution endpoint
- `POST /webhooks/prompt` - Alias for /webhook
- `GET /stream/:executionId` - SSE streaming
- `GET /files/:identifier/*` - File serving
- `GET /health` - Health check
- `GET /metrics` - Metrics endpoint

## Security

- Input validation via Zod schemas
- Rate limiting (60 req/min default)
- Request timeout protection (6 min default)
- Encrypted credentials at rest
- Secure temporary file cleanup
- Correlation IDs for request tracing

## Monitoring

- Structured logging with correlation IDs
- Request/error metrics collection
- Health check endpoint (database + requests)
- Prometheus-style metrics endpoint
- SSE streaming for real-time updates
