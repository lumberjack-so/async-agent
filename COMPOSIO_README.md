# Composio Integration

Alfred now integrates with **Composio** to provide managed OAuth connections and automatic MCP configuration generation for your AI workflows.

## What is Composio?

Composio is a platform that provides:
- **Managed OAuth**: No need to set up OAuth apps - Composio handles authentication
- **Tool Integrations**: Pre-built integrations with GitHub, Slack, Gmail, and 100+ other services
- **User-scoped Authentication**: Each user gets their own authenticated connections
- **Automatic Tool Discovery**: Discover available tools per toolkit

## Quick Start

### 1. Get a Composio API Key

Sign up at [https://app.composio.dev](https://app.composio.dev) and get your API key.

### 2. Enable Composio in Alfred

Add your API key to the environment:

```bash
export COMPOSIO_API_KEY=your_api_key_here
```

Or add it to your `.env` file:

```bash
COMPOSIO_API_KEY=your_api_key_here
COMPOSIO_BASE_URL=https://api.composio.dev
COMPOSIO_USER_ID=default-user
COMPOSIO_CACHE_HOURS=24
```

### 3. Manage Connections

Use the Alfred CLI to manage your Composio connections:

```bash
# List all connections
alfred connections list

# Add a new connection (e.g., GitHub)
alfred connections add github

# Delete a connection
alfred connections delete <connection-id>
```

## How It Works

### Connection Management

When you add a Composio connection:

1. **Alfred** initiates the connection with Composio
2. You authenticate via OAuth (Composio-managed)
3. **Alfred** stores the connection in the database
4. Tools from that connection become available to your skills

### Automatic MCP Config Generation

When you create or update a skill:

1. **Alfred** analyzes the `allowedTools` in each workflow step
2. Automatically extracts toolkit names (e.g., `GITHUB_CREATE_ISSUE` → `github`)
3. Creates a Composio MCP configuration for each step
4. At runtime, generates user-specific MCP URLs for secure, isolated access

### Using Composio Tools in Skills

When defining workflow steps, specify Composio tools in the `allowedTools` array:

```json
{
  "id": 1,
  "prompt": "Create a GitHub issue for the bug report",
  "allowedTools": ["GITHUB_CREATE_ISSUE", "GITHUB_ADD_LABEL"]
}
```

Alfred will:
- Extract the toolkit: `github`
- Create an MCP config with those specific tools
- Generate a user-scoped MCP URL at runtime
- Execute the workflow step with access to those tools

## Features

### ✅ Backward Compatible

- Existing skills and connections work without modification
- Composio is completely optional
- System gracefully degrades if `COMPOSIO_API_KEY` is not set

### ✅ User-Scoped Authentication

- Each user's connections are isolated
- Credentials never stored locally (managed by Composio)
- Per-user MCP URLs for secure execution

### ✅ Automatic Tool Filtering

- Only the tools you specify are available to each step
- Three-tier filtering: SDK tools → MCP servers → MCP tool names
- Fine-grained control over agent capabilities

### ✅ Graceful Degradation

- Skills work even if Composio is unavailable
- Non-Composio tools (SDK, manual MCP servers) still function
- Hooks fail silently without breaking skill operations

## CLI Commands

### `alfred connections`

Main command for managing Composio connections.

**Subcommands:**
- `list [--json]` - List all Composio connections
- `add <toolkit>` - Add a new Composio connection
- `delete <connectionId> [-y]` - Delete a connection

**Examples:**

```bash
# List connections in table format
alfred connections list

# List connections as JSON
alfred connections list --json

# Add GitHub connection
alfred connections add github

# Delete connection (with confirmation)
alfred connections delete conn_123

# Delete connection (skip confirmation)
alfred connections delete conn_123 -y
```

## Available Toolkits

Composio supports 100+ integrations including:

**Development:**
- GitHub
- GitLab
- Bitbucket
- Jira
- Linear

**Communication:**
- Slack
- Discord
- Microsoft Teams
- Gmail
- Outlook

**Productivity:**
- Google Drive
- Notion
- Asana
- Trello
- Airtable

**And many more!**

Run `alfred connections` to browse available toolkits.

## Migration Guide

### For Existing Users

No migration required! Composio integration is:
- **Completely optional** - System works without it
- **Backward compatible** - Existing skills unchanged
- **Non-breaking** - All new database fields have defaults

### To Start Using Composio

1. Set `COMPOSIO_API_KEY` environment variable
2. Run `alfred connections add <toolkit>` for desired integrations
3. Update skills to use Composio tool names (e.g., `GITHUB_CREATE_ISSUE`)

### Mixed Mode

You can use both Composio and manual connections simultaneously:
- **Composio connections**: Managed OAuth, auto-generated MCP configs
- **Manual connections**: Your existing MCP server configurations

Alfred automatically detects the connection source and handles it appropriately.

## Tool Name Format

Composio tools follow the format: `TOOLKIT_ACTION`

**Examples:**
- `GITHUB_CREATE_ISSUE`
- `SLACK_SEND_MESSAGE`
- `GMAIL_SEND_EMAIL`
- `NOTION_CREATE_PAGE`

All uppercase with underscores. The toolkit name is extracted automatically.

## Architecture

### Database Schema

Three new models added (backward compatible):

1. **ComposioMcpConfig** - Stores MCP configs per skill step
2. **ComposioToolkit** - Caches toolkit metadata locally
3. **Connection** (extended) - New fields: `source`, `composioAccountId`, `composioToolkit`, `authStatus`

### Service Layer

```
src/services/composio/
├── client.ts              # Composio API client
├── database.ts            # Database operations
├── utils.ts               # Utility functions
├── errors.ts              # Error classes
├── fallback.ts            # Graceful degradation
├── mcp-config-generator.ts # MCP config lifecycle
└── skill-hooks.ts         # Skill lifecycle hooks
```

### Lifecycle Hooks

Composio hooks into skill lifecycle:

- **afterSkillCreated**: Generate MCP configs for all steps
- **afterSkillUpdated**: Regenerate MCP configs if steps changed
- **beforeSkillDeleted**: Clean up MCP configs from Composio

Hooks are non-blocking and fail gracefully.

## Troubleshooting

### Connection fails with "Composio integration is not enabled"

**Solution**: Set `COMPOSIO_API_KEY` in your environment.

### Tools not showing up in skill execution

**Possible causes:**
1. Connection is not active (check with `alfred connections list`)
2. Tool name format is incorrect (must be `TOOLKIT_ACTION`)
3. Toolkit not added (run `alfred connections add <toolkit>`)

### OAuth authentication not working

**Solution**: Check that the auth URL was opened and completed. Composio manages the OAuth flow, but you must complete it in your browser.

## Security

- **Credentials never stored locally** - Managed by Composio
- **User-scoped MCP URLs** - Each user gets isolated access
- **Tool-level restrictions** - Fine-grained control over capabilities
- **Encrypted database fields** - Connection metadata encrypted at rest

## API Reference

### ComposioClient

Main client for Composio API operations:

```typescript
import { getComposioClient } from './services/composio/client.js';

const client = getComposioClient();

// List connected accounts
const accounts = await client.listConnectedAccounts();

// Get toolkit info
const toolkit = await client.getToolkit('github');

// Create MCP config
const config = await client.createMcpConfig({
  name: 'my-config',
  toolkits: [{ toolkit: 'github' }],
  allowedTools: ['GITHUB_CREATE_ISSUE'],
});
```

### ComposioDatabase

Database operations for Composio data:

```typescript
import { getComposioDatabase } from './services/composio/database.js';

const db = getComposioDatabase();

// Get cached toolkits
const toolkits = await db.getCachedToolkits();

// Get Composio connections
const connections = await db.getComposioConnections();

// Get MCP config for a skill step
const config = await db.getMcpConfigForStep(skillId, stepOrder);
```

## Contributing

Found a bug or want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Same as Alfred core - see [LICENSE](LICENSE).
