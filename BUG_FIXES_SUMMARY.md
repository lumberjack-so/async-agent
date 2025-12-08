# Composio MCP Integration - Bug Fixes Summary

## Overview

This document summarizes all bugs found and fixed during the Composio MCP integration debugging session on 2025-12-08.

## Bugs Fixed ✅

### Bug #1: COMPOSIO_API_KEY undefined
**Commit**: f547114
**Symptom**: `Error: Composio API key not configured`
**Root Cause**: `config/index.ts` created config object before `dotenv.config()` was called
**Fix**: Added `dotenv` import and `config()` call at top of `src/config/index.ts`

### Bug #2: .env file not found from different directories
**Commit**: d6ae67b
**Symptom**: `ENOENT: no such file or directory, open '/private/tmp/.env'`
**Root Cause**: `dotenv.config()` looks in `process.cwd()`, not script location
**Fix**: Calculate project root from compiled script using `import.meta.url`, pass explicit path to `dotenv.config()`

### Bug #3: MCP hook in wrong code path
**Commits**: 8f8a8d4, c8310c7
**Symptom**: Toolkit MCP not created when adding connections via TUI
**Root Cause**: Added MCP hook to `ConnectionsMenu.tsx`, but actual path is `manage.tsx` with `OAuthAuthScreen`
**Fix**: Added `getMcpServerManager().getOrCreateToolkitMcp()` to `onComplete` callback in `manage.tsx`

### Bug #4: Wrong API response field names
**Symptom**: `mcpUrl` was `undefined` when saving to database
**Root Cause**: API returns `mcp_url` and `allowed_tools`, not `url` and `tools`
**Fix**: Updated `mcp-server-manager.ts` to use correct field names

### Bug #5: MCP server name conflicts
**Symptom**: `"An MCP server with name \"gmail-toolkit-mcp\" already exists"`
**Root Cause**: Previous failed attempts created MCP in Composio but not in database
**Fix**: Added 4-char random ID to server name (e.g., `gmail-mcp-a1b2`)

### Bug #6: Missing authentication headers
**Commit**: 28aa1eb
**Symptom**: Claude Agent SDK crashed with exit code 1, MCP URL returned 401 Unauthorized
**Root Cause**: MCP configs missing `X-API-Key` header
**Fix**: Added `headers` object with `X-API-Key` to both toolkit and step MCP configurations

### Bug #7: step.id vs stepOrder mismatch
**Commit**: 61f724d
**Symptom**: `[MCP Manager] Found 0 Composio connections`
**Root Cause**: Database uses `stepOrder` (0, 1, 2) but code passed `step.id` (1, 2, 3)
**Fix**: Added `stepIndex` parameter, orchestrator passes loop index `i` (0, 1, 2)

### Bug #8: Empty connectionNames array
**Symptom**: Skill created with `connectionNames: []`
**Root Cause**: Skill seeded without `connectionNames` populated
**Fix**: Manual database update to set `connectionNames: ['Gmail']`

### Bug #9: Missing connected_account_id query parameter
**Commit**: 0d94bcb
**Symptom**: MCP server returned 401 with `"user_id or connected_account_id query parameter is required"`
**Root Cause**: MCP URLs didn't include required `connected_account_id` parameter
**Fix**: Append `?connected_account_id=${conn.composioAccountId}` to both toolkit and step MCP URLs

### Bug #10: Connection resolver skipping Composio tools
**Commit**: d6accd7
**Symptom**: `[Connection Resolver] Total available MCP tools: 0`
**Root Cause**: Resolver skipped Composio connections (correct for MCP config), but didn't collect their tools for validation (incorrect)
**Fix**: Added `loadComposioTools()` function to separately load Composio tool names for `allowedTools` validation

## Current Status 🔄

### What's Working ✅

1. **Environment variables**: All Composio env vars loaded correctly in Docker
2. **Database connections**: Gmail connection with 23 tools stored correctly
3. **MCP server creation**:
   - Toolkit MCP: `e452b3ab-d3d3-4f1b-95e1-58ec0ffb3d68` (27 tools)
   - Step MCPs for step 0 and step 2 created successfully
4. **MCP configuration**: Correct format with:
   ```json
   {
     "composio-gmail": {
       "url": "https://backend.composio.dev/v3/mcp/...?connected_account_id=ca_JVN51Z7tmCZf",
       "transport": "http",
       "headers": { "X-API-Key": "ak_..." }
     }
   }
   ```
5. **Tool validation**: `[Connection Resolver] Loaded 23 Composio tools from 1 connection(s)`
6. **Tool filtering**: `[WorkflowAgent] Available tools: 1 total` (GMAIL_FETCH_EMAILS)

### Current Issue ❌

**Symptom**:
```
[WorkflowAgent] Error executing step 1: Error: Claude Code process exited with code 1
    at ProcessTransport.getProcessExitError (file:///app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs:6707:14)
```

**Analysis**:
- All MCP configuration is correct
- MCP URLs respond correctly with SSE events
- Headers and query parameters are correct
- SDK successfully loads MCP config
- SDK creates session ID (`INIT - session_id: a60ab6ab-8bd7-4e7b-bc42-65e4f7308a75`)
- **BUT**: Claude Code subprocess exits immediately after INIT

**Possible Causes**:
1. SDK version incompatibility with Composio HTTP MCP servers (using `@anthropic-ai/claude-agent-sdk@^0.1.0`)
2. Missing Claude Code CLI in Docker container
3. SDK expecting different MCP response format
4. Environment variables or dependencies missing for SDK subprocess
5. HTTP MCP transport not fully supported in this SDK version

## Files Modified

1. `docker-compose.yml` - Added COMPOSIO env vars
2. `src/config/index.ts` - Fixed dotenv loading
3. `src/cli/commands/connections/manage.tsx` - Added MCP creation hook
4. `src/services/composio/mcp-server-manager.ts` - Fixed API fields, added headers, fixed queries, added connected_account_id
5. `src/workflow-agent.ts` - Added stepIndex parameter, added MCP config logging
6. `src/workflow-orchestrator.ts` - Pass stepIndex to workflow agent
7. `src/connection-resolver.ts` - Added Composio tools loading for validation

## Commits

1. `f547114` - Add dotenv to config/index.ts
2. `d6ae67b` - Fix dotenv path resolution
3. `8f8a8d4` - Add MCP hook to ConnectionsMenu (wrong location)
4. `c8310c7` - Move MCP hook to manage.tsx (correct location)
5. `28aa1eb` - Add X-API-Key headers to MCP configs
6. `61f724d` - Fix step.id vs stepOrder mismatch
7. `0d94bcb` - Add connected_account_id query parameter
8. `d6accd7` - Load Composio tools for validation

## Next Steps

1. **Investigate Claude Agent SDK**:
   - Check if Claude Code CLI needs to be installed separately
   - Look for SDK environment variable requirements
   - Test with simpler MCP configuration
   - Check SDK compatibility with HTTP MCP transport

2. **Test Alternative Approaches**:
   - Try SDK with stdio MCP transport instead of HTTP
   - Test with a non-Composio HTTP MCP server
   - Check if SDK version needs updating

3. **Get More Debugging Info**:
   - Enable SDK verbose logging if available
   - Capture Claude Code subprocess stderr
   - Test MCP server responses match SDK expectations

---

**Last Updated**: 2025-12-08
**Status**: 10 bugs fixed, 1 remaining (SDK crash)
