/**
 * Connection Resolver
 *
 * Centralized logic for resolving per-step MCP connections from database.
 * Implements three-tier tool filtering: SDK tools, MCP server names, MCP tool names.
 */

import prisma from './db/client.js';
import {
  WorkflowStep,
  Workflow,
  ResolvedConnection,
  StepConnections,
  McpConnections,
} from './types.js';

/**
 * SDK built-in tools from Claude Agent SDK
 */
const SDK_BUILTIN_TOOLS = [
  'Task',
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
  'AskUserQuestion',
  'NotebookEdit',
  'BashOutput',
  'KillShell',
];

/**
 * Check if a tool name is an SDK built-in
 */
export function isSDKBuiltinTool(toolName: string): boolean {
  return SDK_BUILTIN_TOOLS.includes(toolName);
}

/**
 * Resolve which connections a step should use
 * Priority: step.connectionNames > skill.connectionNames
 *
 * @param step - Workflow step
 * @param skill - Parent workflow (for fallback)
 * @returns Array of connection names to load
 */
export function resolveConnectionNames(
  step: WorkflowStep,
  skill: Workflow
): string[] {
  // Step-level connections take priority
  if (step.connectionNames && step.connectionNames.length > 0) {
    console.log(
      `[Connection Resolver] Step ${step.id}: Using step-level connections: ${step.connectionNames.join(', ')}`
    );
    return step.connectionNames;
  }

  // Fallback to skill-level connections
  if (skill.connectionNames && skill.connectionNames.length > 0) {
    console.log(
      `[Connection Resolver] Step ${step.id}: Using skill-level connections (fallback): ${skill.connectionNames.join(', ')}`
    );
    return skill.connectionNames;
  }

  // No connections configured
  console.log(
    `[Connection Resolver] Step ${step.id}: No connections configured (SDK tools only)`
  );
  return [];
}

/**
 * Load connection configurations from database
 * Handles credential decryption (Prisma handles this automatically via field-level encryption)
 *
 * @param connectionNames - Names of connections to load
 * @returns Resolved connection configurations
 */
export async function loadConnectionsFromDatabase(
  connectionNames: string[]
): Promise<ResolvedConnection[]> {
  if (connectionNames.length === 0) {
    return [];
  }

  try {
    const connections = await prisma.connection.findMany({
      where: {
        name: { in: connectionNames },
        isActive: true,
      },
    });

    if (connections.length === 0) {
      console.warn(
        `[Connection Resolver] No active connections found for: ${connectionNames.join(', ')}`
      );
      return [];
    }

    const resolved: ResolvedConnection[] = [];

    for (const conn of connections) {
      // Prisma returns config as Json type, need to cast to expected structure
      const config = conn.config as any;

      if (!config.command || !Array.isArray(config.args)) {
        console.error(
          `[Connection Resolver] Invalid config for connection "${conn.name}" - skipping`
        );
        continue;
      }

      resolved.push({
        name: conn.name,
        command: config.command,
        args: config.args,
        env: config.env || {},
        tools: conn.tools || [],
      });

      console.log(
        `[Connection Resolver] Loaded connection "${conn.name}" with ${conn.tools?.length || 0} tools`
      );
    }

    return resolved;
  } catch (error) {
    console.error(`[Connection Resolver] Database error loading connections:`, error);
    return [];
  }
}

/**
 * Fallback: Load connections from environment variable if database is empty
 *
 * @param connectionNames - Names of connections to load
 * @returns Resolved connection configurations from env var
 */
function loadConnectionsFromEnv(connectionNames: string[]): ResolvedConnection[] {
  if (!process.env.MCP_CONNECTIONS) {
    return [];
  }

  try {
    const envConns = JSON.parse(process.env.MCP_CONNECTIONS);
    const resolved: ResolvedConnection[] = [];

    for (const name of connectionNames) {
      if (envConns[name]) {
        const conn = envConns[name];
        resolved.push({
          name,
          command: conn.command,
          args: conn.args,
          env: conn.env || {},
          tools: [], // Unknown tools from env var
        });
        console.log(
          `[Connection Resolver] Loaded connection "${name}" from env var (fallback)`
        );
      }
    }

    return resolved;
  } catch (error) {
    console.error(
      `[Connection Resolver] Failed to parse MCP_CONNECTIONS env var:`,
      error
    );
    return [];
  }
}

/**
 * Convert ResolvedConnection[] to McpConnections format for Claude SDK
 *
 * @param connections - Resolved connections
 * @returns MCP connections object for Claude SDK
 */
export function buildMcpConnections(
  connections: ResolvedConnection[]
): McpConnections {
  const mcpConnections: McpConnections = {};

  for (const conn of connections) {
    mcpConnections[conn.name] = {
      command: conn.command,
      args: conn.args,
      env: conn.env,
    };
  }

  return mcpConnections;
}

/**
 * Three-tier tool filtering logic
 *
 * Tier 1: SDK built-in tools (e.g., 'Read', 'Write', 'Bash')
 * Tier 2: MCP server names (e.g., 'github') - allows ALL tools from that server
 * Tier 3: Exact MCP tool names (e.g., 'github__create_pr')
 *
 * @param step - Workflow step with allowedTools
 * @param availableTools - All available MCP tool names from connections
 * @param connectionNames - Active connection names
 * @returns Filtered list of allowed tools
 */
export function filterToolsForStep(
  step: WorkflowStep,
  availableTools: string[],
  connectionNames: string[]
): string[] {
  // No restrictions - allow everything
  if (!step.allowedTools || step.allowedTools.length === 0) {
    return availableTools;
  }

  const allowedSet = new Set<string>();

  for (const allowed of step.allowedTools) {
    // Tier 1: SDK built-in tools (pass through directly)
    if (isSDKBuiltinTool(allowed)) {
      allowedSet.add(allowed);
      continue;
    }

    // Tier 2: MCP server names (allow all tools from that server)
    if (connectionNames.includes(allowed)) {
      const serverPrefix = `${allowed}__`;
      const toolsFromServer = availableTools.filter((tool) =>
        tool.startsWith(serverPrefix)
      );

      if (toolsFromServer.length > 0) {
        console.log(
          `[Connection Resolver] Step ${step.id}: Allowing ${toolsFromServer.length} tools from server "${allowed}"`
        );
        toolsFromServer.forEach((t) => allowedSet.add(t));
      }
      continue;
    }

    // Tier 3: Exact MCP tool names
    if (availableTools.includes(allowed)) {
      allowedSet.add(allowed);
      continue;
    }

    // Tool not found - log warning
    console.warn(
      `[Connection Resolver] Step ${step.id}: Tool "${allowed}" not found in available tools or connections`
    );
  }

  const filtered = Array.from(allowedSet);
  console.log(
    `[Connection Resolver] Step ${step.id}: Filtered ${filtered.length} allowed tools from ${availableTools.length} available`
  );

  return filtered;
}

/**
 * Main entry point: Resolve all connections for a workflow step
 *
 * Performs complete resolution flow:
 * 1. Resolve which connections to use (step-level or skill-level)
 * 2. Load connection configurations from database
 * 3. Fallback to environment variable if database is empty
 * 4. Build McpConnections format for Claude SDK
 * 5. Collect all available MCP tools
 * 6. Filter tools based on allowedTools (three-tier logic)
 *
 * @param step - Workflow step
 * @param skill - Parent workflow
 * @returns Step connections with filtered tools and MCP configs
 */
export async function resolveStepConnections(
  step: WorkflowStep,
  skill: Workflow
): Promise<StepConnections> {
  console.log(`[Connection Resolver] ========================================`);
  console.log(`[Connection Resolver] Resolving connections for step ${step.id}`);

  // 1. Resolve which connections to use
  const connectionNames = resolveConnectionNames(step, skill);

  // 2. Load from database
  let connections = await loadConnectionsFromDatabase(connectionNames);

  // 3. Fallback to env var if database is empty
  if (connections.length === 0 && connectionNames.length > 0) {
    console.log(
      `[Connection Resolver] No database connections found, trying env var fallback`
    );
    connections = loadConnectionsFromEnv(connectionNames);
  }

  // 4. Build MCP format for Claude SDK
  const mcpConnections = buildMcpConnections(connections);

  // 5. Collect all available MCP tools
  const availableTools = connections.flatMap((c) => c.tools);

  console.log(
    `[Connection Resolver] Total available MCP tools: ${availableTools.length}`
  );

  // 6. Filter based on allowedTools (three-tier logic)
  const filteredTools = filterToolsForStep(step, availableTools, connectionNames);

  console.log(`[Connection Resolver] Resolution complete for step ${step.id}`);
  console.log(`[Connection Resolver] ========================================\n`);

  return {
    mcpConnections,
    availableTools: filteredTools,
    connectionNames,
  };
}
