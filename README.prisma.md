# User VM Database Schema

This document describes the database schema for the user's isolated VM.

## Security Model

**ALL SECRETS STORED HERE** (encrypted at rest)

Unlike Alfred Core (which stores no secrets), this VM database contains:
- Anthropic API keys (encrypted)
- MCP connection credentials (encrypted)
- OAuth tokens (encrypted)
- Service API keys (encrypted)

The encryption key (`VM_ENCRYPTION_SECRET`) is generated during provisioning and NEVER leaves the VM.

## Database Tables

### connections
Stores MCP server and API integrations.

**Key fields:**
- `config` (JSONB): Contains encrypted credentials
  - Example: `{command: "npx", args: [...], env: {API_KEY: "encrypted:xxx"}}`
- `tools` (String[]): Discovered tools from MCP connection
- `type`: 'mcp_stdio', 'mcp_http', or 'http_api'

### skills
User-defined workflows (manually created, from templates, or taught via chat).

**Key fields:**
- `steps` (JSONB): Workflow step definitions
  - Format: `[{id: 1, prompt: "...", guidance: "...", allowedTools: [...]}]`
- `connectionNames` (String[]): Which connections this skill uses
- `triggerType`: How the skill is invoked ('manual', 'schedule', 'webhook', 'chat')
- `isSystem`: System skills (like "Teach New Skill") cannot be deleted

### executions
Complete audit log of skill executions.

**Contains FULL execution data:**
- `input` (JSONB): Full input parameters
- `output` (String): Complete result
- `trace` (JSONB): Full conversation trace from Claude Agent SDK
- `error` (String): Error messages if failed

**Metrics for billing:**
- `durationMs`: Execution time
- `tokenCount`: Tokens consumed
- `costUsd`: Estimated cost
- `reportedToCore`: Whether metrics (NOT content) sent to Alfred Core

### config
Key-value store for VM configuration.

**Example entries:**
```sql
-- Anthropic API key (encrypted)
INSERT INTO config (key, value) VALUES
  ('anthropic_api_key', 'encrypted:sk-ant-...');

-- VM auth secret (plaintext, sent to Core as bcrypt hash)
INSERT INTO config (key, value) VALUES
  ('vm_auth_secret', 'plain:random-secret-string');

-- VM encryption key (NEVER leaves VM)
INSERT INTO config (key, value) VALUES
  ('vm_encryption_secret', 'plain:aes-256-key');

-- Alfred Core public key (for JWT verification)
INSERT INTO config (key, value) VALUES
  ('alfred_core_public_key', 'plain:-----BEGIN PUBLIC KEY-----...');
```

## Data Encryption

Credentials in the `config` JSONB field are encrypted using AES-256-GCM:

```typescript
// Pseudo-code
const encrypted = encrypt(apiKey, VM_ENCRYPTION_SECRET);
// Stored as: "encrypted:base64-cipher-text"
```

## Database Migrations

Migrations are in `prisma/migrations/`. To apply:

```bash
npx prisma migrate deploy
```

## Testing

Schema validation tests ensure:
- Proper encryption documentation
- All required tables exist
- Indexes are correctly defined
- Relations have proper cascade rules

Run tests:
```bash
npm test tests/schema.test.ts
```

## Relationship to Alfred Core

This VM reports ONLY sanitized metrics to Alfred Core:
- Number of executions
- Total duration
- Token counts

Alfred Core NEVER sees:
- Execution inputs/outputs
- Conversation traces
- User credentials
- Skill definitions
