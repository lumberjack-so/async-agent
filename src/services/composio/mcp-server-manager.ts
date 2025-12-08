/**
 * Composio MCP Server Manager
 *
 * Manages Composio MCP server lifecycle:
 * - Toolkit-level MCP servers (reusable across skills)
 * - Step-level custom MCP servers (per skill step)
 * - Fetches MCP configs for Claude SDK
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../../config/index.js';
import prisma from '../../db/client.js';
import type { McpServerConfig } from '../../types.js';
import { extractToolkits } from './utils.js';

/**
 * MCP Server Manager - Handles Composio MCP server creation and retrieval
 */
export class ComposioMcpServerManager {
  private client: AxiosInstance;

  constructor() {
    if (!config.composio?.apiKey) {
      throw new Error('Composio API key not configured');
    }

    this.client = axios.create({
      baseURL: 'https://backend.composio.dev/api',
      headers: {
        'X-API-Key': config.composio.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Get or create toolkit-level MCP server (reusable)
   * Creates one MCP server per toolkit if it doesn't exist
   */
  async getOrCreateToolkitMcp(toolkit: string): Promise<{
    mcpServerId: string;
    mcpUrl: string;
    tools: string[];
  }> {
    console.log(`[MCP Manager] Getting or creating toolkit MCP for: ${toolkit}`);

    // Check if toolkit MCP already exists in database
    const existing = await prisma.composioToolkitMcp.findUnique({
      where: { toolkit },
    });

    if (existing) {
      console.log(`[MCP Manager] ✓ Using existing toolkit MCP: ${existing.mcpServerId}`);
      return {
        mcpServerId: existing.mcpServerId,
        mcpUrl: existing.mcpUrl,
        tools: existing.tools,
      };
    }

    // Get auth config ID for this toolkit
    const authConfigId = await this.getOrCreateAuthConfig(toolkit);

    // Create toolkit-level MCP server via Composio API
    console.log(`[MCP Manager] Creating toolkit MCP server for ${toolkit}...`);
    const response = await this.client.post('/v3/mcp/servers', {
      name: `${toolkit}-toolkit-mcp`,
      auth_config_ids: [authConfigId],
    });

    const mcpServerId = response.data.id;
    const mcpUrl = response.data.url;
    const tools = response.data.tools || [];

    console.log(`[MCP Manager] ✓ Created toolkit MCP: ${mcpServerId}`);
    console.log(`[MCP Manager]   URL: ${mcpUrl}`);
    console.log(`[MCP Manager]   Tools: ${tools.length}`);

    // Save to database
    await prisma.composioToolkitMcp.create({
      data: {
        toolkit,
        authConfigId,
        mcpServerId,
        mcpUrl,
        tools,
      },
    });

    return { mcpServerId, mcpUrl, tools };
  }

  /**
   * Create or update step-level custom MCP server
   * Combines tools from multiple toolkits for a specific skill step
   */
  async createStepMcp(
    skillId: string,
    stepOrder: number,
    allowedTools: string[]
  ): Promise<{
    mcpServerId: string;
    mcpUrl: string;
  }> {
    console.log(`[MCP Manager] Creating step MCP for skill ${skillId}, step ${stepOrder}`);
    console.log(`[MCP Manager]   Allowed tools: ${allowedTools.length}`);

    // Extract toolkits from allowed tools
    const toolkits = extractToolkits(allowedTools);
    console.log(`[MCP Manager]   Toolkits needed: ${toolkits.join(', ')}`);

    if (toolkits.length === 0) {
      throw new Error('No Composio toolkits found in allowed tools');
    }

    // Get auth config IDs for all toolkits
    const authConfigIds: string[] = [];
    for (const toolkit of toolkits) {
      const authConfigId = await this.getOrCreateAuthConfig(toolkit);
      authConfigIds.push(authConfigId);
    }

    // Delete existing step MCP if it exists
    await this.deleteStepMcp(skillId, stepOrder);

    // Create custom step-level MCP server via Composio API
    console.log(`[MCP Manager] Calling Composio API to create custom MCP...`);
    const response = await this.client.post('/v3/mcp/servers/custom', {
      name: `skill-${skillId.slice(0, 8)}-step-${stepOrder}`,
      tools: allowedTools,
      auth_config_ids: authConfigIds,
    });

    const mcpServerId = response.data.id;
    const mcpUrl = response.data.url;

    console.log(`[MCP Manager] ✓ Created step MCP: ${mcpServerId}`);
    console.log(`[MCP Manager]   URL: ${mcpUrl}`);

    // Save to database
    await prisma.composioStepMcp.create({
      data: {
        skillId,
        stepOrder,
        authConfigIds,
        mcpServerId,
        mcpUrl,
        allowedTools,
      },
    });

    return { mcpServerId, mcpUrl };
  }

  /**
   * Delete step-level MCP server
   */
  async deleteStepMcp(skillId: string, stepOrder: number): Promise<void> {
    const existing = await prisma.composioStepMcp.findUnique({
      where: { skillId_stepOrder: { skillId, stepOrder } },
    });

    if (!existing) {
      return; // Nothing to delete
    }

    console.log(`[MCP Manager] Deleting existing step MCP: ${existing.mcpServerId}`);

    // Delete from Composio API
    try {
      await this.client.delete(`/v3/mcp/servers/${existing.mcpServerId}`);
    } catch (error) {
      console.warn(`[MCP Manager] Failed to delete MCP server from Composio:`, error);
      // Continue with database deletion even if API call fails
    }

    // Delete from database
    await prisma.composioStepMcp.delete({
      where: { skillId_stepOrder: { skillId, stepOrder } },
    });

    console.log(`[MCP Manager] ✓ Deleted step MCP`);
  }

  /**
   * Get MCP server configuration for a skill step
   * Returns both skill-level fallback and step-level custom MCPs
   */
  async getMcpConfigForStep(
    skillId: string,
    stepOrder: number
  ): Promise<Record<string, any>> {
    console.log(`[MCP Manager] Getting MCP config for skill ${skillId}, step ${stepOrder}`);

    const mcpConfig: Record<string, any> = {};

    // Load skill to get connection names
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      include: { connections: true },
    });

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    // Add toolkit-level MCPs (skill-level fallback)
    const composioConnections = skill.connections.filter((c) => c.source === 'composio');
    console.log(`[MCP Manager] Found ${composioConnections.length} Composio connections`);

    for (const conn of composioConnections) {
      if (!conn.composioToolkit) {
        continue;
      }

      const toolkitMcp = await prisma.composioToolkitMcp.findUnique({
        where: { toolkit: conn.composioToolkit },
      });

      if (toolkitMcp) {
        mcpConfig[`composio-${conn.composioToolkit}`] = {
          url: toolkitMcp.mcpUrl,
          transport: 'http',
        };
        console.log(`[MCP Manager]   Added toolkit MCP: ${conn.composioToolkit}`);
      }
    }

    // Add step-level custom MCP (overrides toolkit MCPs for this step)
    const stepMcp = await prisma.composioStepMcp.findUnique({
      where: { skillId_stepOrder: { skillId, stepOrder } },
    });

    if (stepMcp) {
      mcpConfig[`composio-step-${stepOrder}`] = {
        url: stepMcp.mcpUrl,
        transport: 'http',
      };
      console.log(`[MCP Manager]   Added step MCP: ${stepMcp.mcpServerId}`);
    }

    console.log(`[MCP Manager] ✓ MCP config ready with ${Object.keys(mcpConfig).length} servers`);
    return mcpConfig;
  }

  /**
   * Get or create auth config for a toolkit
   * Reuses existing auth config if available
   */
  private async getOrCreateAuthConfig(toolkit: string): Promise<string> {
    console.log(`[MCP Manager] Getting auth config for ${toolkit}...`);

    // Try to get existing auth config
    const response = await this.client.get('/v3/auth_configs', {
      params: { toolkit },
    });

    const existingConfigs = response.data.items || [];
    const matchingConfigs = existingConfigs.filter((c: any) => {
      const configToolkit = c.toolkit?.slug || c.toolkit;
      return configToolkit === toolkit;
    });

    if (matchingConfigs.length > 0) {
      console.log(`[MCP Manager]   ✓ Using existing auth config: ${matchingConfigs[0].id}`);
      return matchingConfigs[0].id;
    }

    // Create new auth config
    console.log(`[MCP Manager]   Creating new auth config...`);
    const createResponse = await this.client.post('/v3/auth_configs', {
      toolkit: { slug: toolkit },
      name: toolkit,
      auth_config: {
        type: 'use_composio_managed_auth',
      },
    });

    const authConfigId = createResponse.data.auth_config.id;
    console.log(`[MCP Manager]   ✓ Created auth config: ${authConfigId}`);
    return authConfigId;
  }
}

/**
 * Singleton instance
 */
let mcpServerManagerInstance: ComposioMcpServerManager | null = null;

export function getMcpServerManager(): ComposioMcpServerManager {
  if (!mcpServerManagerInstance) {
    mcpServerManagerInstance = new ComposioMcpServerManager();
  }
  return mcpServerManagerInstance;
}
