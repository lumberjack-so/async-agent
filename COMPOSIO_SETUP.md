# Composio Integration Setup Guide

## Overview

Alfred now integrates with Composio to provide managed OAuth connections and automatic tool discovery. This guide explains how to set up and use the Composio integration.

## Features

✅ **Automatic Toolkit Sync**: Fetches all available toolkits from Composio on startup
✅ **Connection Status Monitoring**: Checks connection health and notifies on issues
✅ **Interactive TUI**: Browse and manage connections with a beautiful terminal UI
✅ **OAuth Flow**: Simplified OAuth authentication with polling
✅ **Database Caching**: Toolkits cached locally for fast browsing

## Setup

### 1. Get Your Composio API Key

1. Sign up at [https://app.composio.dev](https://app.composio.dev)
2. Navigate to Settings → API Keys
3. Create a new API key

### 2. Configure Environment

Add your Composio API key to your `.env` file:

```bash
# Composio Integration
COMPOSIO_API_KEY=your_api_key_here
COMPOSIO_BASE_URL=https://backend.composio.dev/api  # Optional, uses this by default
COMPOSIO_USER_ID=                                    # Optional, default user ID
COMPOSIO_CACHE_HOURS=24                              # Optional, hours to cache toolkits
```

### 3. Install and Sync

When you install Alfred, it will automatically:
- Sync all available toolkits from Composio to your database
- Cache toolkit metadata for fast browsing

You can manually trigger a sync at any time:

```bash
npm install  # Runs postinstall script
```

## Usage

### Managing Connections

Launch the interactive connection manager:

```bash
alfred connections
```

Or use the alias:

```bash
alfred conn
```

#### Available Commands

```bash
# Launch interactive TUI (default)
alfred connections

# List connections in table format
alfred connections list
alfred connections list --json  # JSON output

# Add a connection (non-interactive)
alfred connections add github

# Delete a connection
alfred connections delete <connection-id>
alfred connections delete <connection-id> -y  # Skip confirmation
```

### Interactive TUI Features

When you run `alfred connections`, you'll see:

1. **Main Screen**: List of all your connections with status indicators
   - ✓ Active (green) - Connection is working
   - ⚠ Needs Auth (yellow) - Re-authentication required
   - ○ Expired (gray) - Connection has expired
   - ✗ Failed (red) - Connection failed

2. **Browse Toolkits**: View all available Composio toolkits
   - Search by name, description, or category
   - Grouped by category (Development, Productivity, Communication, etc.)
   - 100+ toolkits available

3. **Connection Options**:
   - 🔄 Reauthenticate - Refresh OAuth credentials
   - ⏸ Disable/▶️ Enable - Toggle connection active status
   - 🗑 Delete - Remove connection from Alfred

### Adding a New Connection

1. Run `alfred connections`
2. Select "Browse toolkits and add connection"
3. Search for your desired toolkit (e.g., "github", "slack", "gmail")
4. Select the toolkit
5. Follow the OAuth flow:
   - A URL will be displayed
   - Open it in your browser
   - Authorize the connection
   - Alfred will automatically detect when auth is complete (polls every 5 seconds)
6. Connection is saved and ready to use!

## Startup Behavior

Every time Alfred starts:

1. **Toolkit Sync**: Checks if toolkit cache is stale (default: 24 hours)
   - If stale, fetches latest toolkits from Composio
   - If fresh, uses cached data

2. **Connection Status Check**: Verifies all Composio connections
   - Updates status in database
   - Notifies if any connections need attention

Example startup output:

```
[Composio] Syncing toolkits from API...
[Composio] ✓ Synced 120 toolkits

⚠  2 Composio connections need attention
Run alfred connections to view details
```

## Database Schema

The integration adds two new tables:

### `composio_toolkits`

Caches toolkit metadata from Composio:

- `name` - Toolkit identifier (e.g., "github")
- `displayName` - Human-readable name (e.g., "GitHub")
- `description` - What the toolkit does
- `category` - Category (e.g., "Development")
- `logoUrl` - Toolkit logo URL
- `authScheme` - Authentication method
- `tools` - Array of tool names available
- `lastSynced` - Last sync timestamp

### `composio_mcp_configs`

Stores MCP configurations for skill steps:

- `skillId` - Associated skill ID
- `stepOrder` - Which step this config is for
- `mcpConfigId` - Composio MCP config ID
- `toolkits` - Toolkits included
- `allowedTools` - Specific tools allowed

### Extended `connections` table

New fields added:

- `source` - "manual" or "composio"
- `composioAccountId` - Composio connected account ID
- `composioToolkit` - Toolkit name
- `authStatus` - "active", "needs_auth", "expired", or "failed"

### Extended `skills` table

New field:

- `composioUserId` - User ID for Composio MCP configs

## How It Works

### Toolkit Sync Flow

```
Alfred Startup
    ↓
Check cache age (default: 24 hours)
    ↓
If stale → Fetch from Composio API → Save to database
If fresh → Use cached data
```

### Connection Creation Flow

```
User selects toolkit
    ↓
Create auth config (Composio API)
    ↓
Create connected account (Composio API)
    ↓
Generate OAuth URL
    ↓
User authorizes in browser
    ↓
Poll for completion (max 5 minutes)
    ↓
Fetch available tools
    ↓
Save connection to database
```

### Connection Status Check Flow

```
Alfred Startup
    ↓
Get all Composio connections from database
    ↓
For each connection:
    Check status via Composio API
    Update database if changed
    ↓
Generate report
    ↓
Notify user if issues found
```

## Troubleshooting

### "Composio integration is not enabled"

**Solution**: Make sure `COMPOSIO_API_KEY` is set in your `.env` file

### "Authentication timed out"

**Solution**: The OAuth flow has a 5-minute timeout. Make sure to:
- Complete the OAuth flow within 5 minutes
- Check your internet connection
- Verify the toolkit supports OAuth

### "Failed to sync toolkits"

**Solution**:
- Check your API key is valid
- Check your internet connection
- Verify Composio API is accessible
- Try manual sync: restart Alfred server

### "Connection status check failed"

**Solution**:
- Connection may have been deleted from Composio dashboard
- Re-add the connection via `alfred connections`

## API Reference

### ToolkitSyncService

```typescript
const service = getToolkitSyncService();

// Sync toolkits (force sync even if cache is fresh)
await service.syncToolkits(true);

// Get all toolkits
const toolkits = await service.getAllToolkits();

// Search toolkits
const results = await service.searchToolkits('github');

// Get toolkit by name
const github = await service.getToolkit('github');

// Get toolkits grouped by category
const byCategory = await service.getToolkitsByCategory();
```

### ConnectionStatusChecker

```typescript
const checker = getConnectionStatusChecker();

// Check all connections
const report = await checker.checkAllConnections();

// Print detailed report
checker.printReport(report);

// Print simple notification
checker.printNotification(report);
```

### ComposioClient

```typescript
const client = getComposioClient();

// List all toolkits
const toolkits = await client.listToolkits();

// Get specific toolkit
const github = await client.getToolkit('github');

// Get toolkit tools
const tools = await client.getToolkitTools('github');

// Initiate connection
const auth = await client.initiateConnection({
  toolkitName: 'github',
  userId: 'user123',
});

// Check connection status
const status = await client.checkConnectionStatus(accountId);

// Delete connection
await client.deleteConnectedAccount(accountId);
```

### ComposioDatabase

```typescript
const db = getComposioDatabase();

// Sync toolkits to database
await db.syncToolkits(toolkits);

// Get cached toolkits
const cached = await db.getCachedToolkits();

// Search toolkits
const results = await db.searchToolkits('github');

// Check if refresh needed
const shouldRefresh = await db.shouldRefreshToolkits(24);

// Create Composio connection
await db.createComposioConnection({
  name: 'GitHub',
  composioAccountId: 'acc123',
  composioToolkit: 'github',
  tools: ['GITHUB_CREATE_ISSUE', 'GITHUB_CREATE_PR'],
});

// Update connection status
await db.updateConnectionAuthStatus(connectionId, 'active');

// Get all Composio connections
const connections = await db.getComposioConnections();
```

## Best Practices

1. **Cache Duration**: Keep the default 24-hour cache unless you need more frequent updates
2. **Connection Status**: Check connection status regularly to catch auth issues early
3. **OAuth Timeout**: Complete OAuth flows within 5 minutes to avoid timeouts
4. **Error Handling**: The system gracefully degrades if Composio is unavailable
5. **Multiple Users**: Use `COMPOSIO_USER_ID` for user-scoped connections

## Security

- API keys are stored in environment variables (never committed)
- OAuth tokens are managed by Composio (never stored locally)
- Connection configs are encrypted in the database
- All API calls use HTTPS
- Graceful degradation if Composio is unavailable

## Support

For issues or questions:
- Check Composio documentation: [https://docs.composio.dev](https://docs.composio.dev)
- Check Alfred documentation: `CLAUDE.md`
- Report issues: GitHub Issues

## Changelog

### v1.0.0 (2025-12-06)

- ✅ Initial Composio integration
- ✅ Automatic toolkit sync on startup
- ✅ Connection status monitoring
- ✅ Interactive TUI for connection management
- ✅ OAuth flow with polling
- ✅ Database caching for performance
- ✅ Comprehensive error handling
