# MCP Loading Investigation Report

## Executive Summary

The orchestrator is not loading Composio MCP servers for two independent reasons:

1. **PRIMARY ISSUE**: Docker container missing `COMPOSIO_API_KEY` environment variable
2. **SECONDARY ISSUE**: Skills-Connections database relation not established

## Problem Statement

When running the Email Digest skill via the orchestrator, the logs show:
```
[WorkflowAgent] Total MCP servers: 0
[Connection Resolver] Total available MCP tools: 0
```

Despite:
- ComposioToolkitMcp record exists for Gmail (27 tools)
- ComposioStepMcp records exist for steps 0 and 2
- Gmail connection exists in database with `source='composio'`

## Root Cause Analysis

### Issue #1: Missing COMPOSIO_API_KEY in Docker Container

#### Evidence

1. **docker-compose.yml (lines 39-70)**: Does NOT include COMPOSIO_API_KEY in environment variables
   ```yaml
   environment:
     DATABASE_URL: postgresql://...
     ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
     PORT: 3001
     # ... other vars ...
     # COMPOSIO_API_KEY is MISSING!
   ```

2. **Container verification**:
   ```bash
   $ docker exec async-agent-app printenv | grep COMPOSIO
   # (no output - variable not set)
   ```

3. **.env file HAS the key**:
   ```bash
   $ grep COMPOSIO_API_KEY .env
   COMPOSIO_API_KEY=ak_O2jAzjVgkWGDIV2W4uE6
   ```

#### Code Flow

When the container starts:

```typescript
// src/config/index.ts:107-113
composio: {
  apiKey: process.env.COMPOSIO_API_KEY,  // <- undefined in container
  enabled: !!process.env.COMPOSIO_API_KEY,  // <- false
}

// src/config/index.ts:307-309
export function isComposioEnabled(): boolean {
  return config.composio.enabled && !!config.composio.apiKey;  // <- false
}

// src/services/composio/client.ts:304-306
export function isComposioAvailable(): boolean {
  return isComposioEnabled();  // <- false
}

// src/workflow-agent.ts:57-66
if (isComposioAvailable()) {  // <- SKIPPED! Block never executes
  try {
    const mcpManager = getMcpServerManager();
    composioMcpConfig = await mcpManager.getMcpConfigForStep(skill.id, step.id);
    console.log(`[WorkflowAgent] Loaded Composio MCP config...`);
  } catch (error) {
    console.warn('[WorkflowAgent] Failed to load Composio MCP config:', error);
  }
}
```

**Result**: The entire MCP loading block is skipped, no logs are generated, `composioMcpConfig` remains empty object.

#### Impact

- Severity: **CRITICAL** - Completely blocks MCP loading
- Scope: All skill executions in Docker environment
- Detection: Silent failure (no error logs, just empty MCP servers)

### Issue #2: Missing Skill-Connection Database Relation

#### Evidence

Database query shows:
```javascript
Email Digest skill:
  ID: 64f52650-de98-44c7-aebd-a1dd3b529413
  connectionNames: [ 'Gmail' ]  // <- String array field
  connections relation: 0 connected  // <- Database relation is EMPTY!
```

#### Code Flow

Even IF Issue #1 were fixed:

```typescript
// src/services/composio/mcp-server-manager.ts:200-212
async getMcpConfigForStep(skillId: string, stepOrder: number) {
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: { connections: true },  // <- Uses RELATION, not connectionNames array
  });

  const composioConnections = skill.connections.filter((c) => c.source === 'composio');
  console.log(`[MCP Manager] Found ${composioConnections.length} Composio connections`);
  // Would log: Found 0 Composio connections
}
```

**Result**: Even with COMPOSIO_API_KEY set, `getMcpConfigForStep` would return empty config because `skill.connections` relation is empty.

#### Schema Analysis

The Skill model has TWO separate fields for connections:

```prisma
model Skill {
  // String array (legacy, currently used for display)
  connectionNames String[]  @default([]) @map("connection_names")

  // Database relation (many-to-many, NOT populated)
  connections     Connection[] @relation("SkillConnections")
}
```

When skills are created (e.g., in `seed-digest-skill.js`):
```javascript
await prisma.skill.create({
  data: {
    name: 'Email Digest',
    connectionNames: ['Gmail'],  // <- Sets string array
    // connections: {...}  <- MISSING! Relation not created
  }
});
```

#### Impact

- Severity: **HIGH** - Would block MCP loading even after fixing Issue #1
- Scope: All skills created without explicit `connections` relation
- Detection: Would show logs "[MCP Manager] Found 0 Composio connections"

## Formal Logical Proof

### Condition A: COMPOSIO_API_KEY Missing
```
IF docker-compose.yml does NOT include COMPOSIO_API_KEY
AND .env file is NOT loaded into Docker container
THEN process.env.COMPOSIO_API_KEY === undefined
THEN config.composio.enabled === false
THEN isComposioAvailable() === false
THEN workflow-agent.ts MCP loading block is SKIPPED
THEN allMcpServers === {}
CONCLUSION: No MCP servers loaded (Issue #1)
```

### Condition B: Skill-Connection Relation Missing
```
IF skill.connections relation is empty
AND getMcpConfigForStep uses skill.connections (not connectionNames)
THEN composioConnections.length === 0
THEN no toolkit MCPs added to mcpConfig
THEN getMcpConfigForStep returns {}
THEN allMcpServers === {}
CONCLUSION: No MCP servers loaded (Issue #2)
```

### Combined Effect
```
IF Condition A (COMPOSIO_API_KEY missing)
THEN Issue #1 causes failure (MCP loading skipped entirely)

IF Condition A is FIXED
AND Condition B (relation missing) still exists
THEN Issue #2 causes failure (getMcpConfigForStep returns empty)

THEREFORE: Both issues must be fixed for MCP loading to work
```

## Verification Steps

### Verify Issue #1
```bash
# Check container environment
docker exec async-agent-app printenv | grep COMPOSIO
# Expected: (empty)

# Check docker-compose.yml
grep "COMPOSIO" docker-compose.yml
# Expected: (no matches)

# Check .env file
grep "COMPOSIO_API_KEY" .env
# Expected: COMPOSIO_API_KEY=ak_...
```

### Verify Issue #2
```bash
# Check skill-connection relation
node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const skill = await prisma.skill.findFirst({
  where: { name: 'Email Digest' },
  include: { connections: true }
});
console.log('Connections:', skill.connections.length);
await prisma.\$disconnect();
"
# Expected: 0
```

## Alternative Hypotheses Considered and Disproven

1. **"Database doesn't have MCP records"**
   - DISPROVEN: browse-db.js shows both ComposioToolkitMcp and ComposioStepMcp exist

2. **"Skill/step data is wrong"**
   - DISPROVEN: Email Digest skill has correct steps with allowedTools

3. **"getMcpConfigForStep has a bug"**
   - DISPROVEN: Function never gets called (no logs), issue is before this point

4. **"Error is being caught and suppressed"**
   - DISPROVEN: Would see "[WorkflowAgent] Failed to load..." log, but no MCP logs at all

5. **"Using step.id instead of step order"**
   - IRRELEVANT: getMcpConfigForStep never called due to Issue #1

## Recommended Fixes

### Fix #1: Add COMPOSIO_API_KEY to docker-compose.yml

In `docker-compose.yml` environment section (after line 44):
```yaml
environment:
  # ... existing vars ...
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}

  # Add Composio configuration
  COMPOSIO_API_KEY: ${COMPOSIO_API_KEY}
  COMPOSIO_BASE_URL: ${COMPOSIO_BASE_URL:-https://backend.composio.dev/api}
  COMPOSIO_USER_ID: ${COMPOSIO_USER_ID:-}
```

Then rebuild and restart:
```bash
docker-compose up -d --build
```

### Fix #2: Establish Skill-Connection Relations

**Option A**: Update skill creation to use relation instead of string array

**Option B**: Update `getMcpConfigForStep` to use `connectionNames` array
- Query connections by name instead of using relation
- More compatible with existing skill creation code

**Option C**: Create a migration/backfill to establish relations
- For each skill, find connections by `connectionNames` and create relations

## Testing After Fixes

1. Fix both issues
2. Rebuild Docker container
3. Run orchestrator with Email Digest skill
4. Expected logs:
   ```
   [WorkflowAgent] Loaded Composio MCP config with 2 server(s)
   [MCP Manager] Found 1 Composio connections
   [MCP Manager]   Added toolkit MCP: gmail
   [MCP Manager]   Added step MCP: <step_mcp_id>
   [WorkflowAgent] Total MCP servers: 2
   ```

## Conclusion

Two independent blocking issues prevent MCP loading:

1. **Docker configuration issue**: COMPOSIO_API_KEY not passed to container
2. **Database schema issue**: Skills use `connectionNames` array but MCP loading uses `connections` relation

Both must be fixed for the orchestrator to successfully load Composio MCP servers.

---

**Investigation Date**: 2025-12-07
**Investigator**: Claude Code
**Status**: Root causes identified, awaiting fixes
