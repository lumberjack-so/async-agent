/**
 * Composio Skill Lifecycle Hooks
 *
 * Hooks to call after skill creation/update/deletion for MCP config management
 */

import { getMcpServerManager } from './mcp-server-manager.js';
import { isComposioAvailable } from './client.js';
import { extractToolkits } from './utils.js';
import type { Skill } from '@prisma/client';

interface SkillStep {
  id: number;
  prompt: string;
  allowedTools?: string[];
}

/**
 * Hook to call after skill is created
 */
export async function afterSkillCreated(skill: Skill): Promise<void> {
  if (!isComposioAvailable()) {
    return; // Graceful degradation
  }

  try {
    const mcpManager = getMcpServerManager();
    const steps = skill.steps as unknown as SkillStep[];

    console.log(`[Skill Hooks] Creating MCP servers for skill ${skill.name} (${steps.length} steps)`);

    // Create step-level MCP servers for each step with Composio tools
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const allowedTools = step.allowedTools || [];

      // Extract Composio toolkits from allowed tools
      const toolkits = extractToolkits(allowedTools);

      if (toolkits.length > 0) {
        console.log(`[Skill Hooks]   Step ${i}: Creating MCP for ${toolkits.length} toolkit(s)`);
        await mcpManager.createStepMcp(skill.id, i, allowedTools);
      } else {
        console.log(`[Skill Hooks]   Step ${i}: No Composio tools, skipping MCP creation`);
      }
    }

    console.log(`[Skill Hooks] ✓ MCP servers created for skill ${skill.name}`);
  } catch (error) {
    console.error('[Composio] Failed to generate MCP configs for skill:', error);
    // Non-fatal: skill still works without Composio configs
  }
}

/**
 * Hook to call after skill is updated
 */
export async function afterSkillUpdated(skill: Skill): Promise<void> {
  if (!isComposioAvailable()) {
    return;
  }

  try {
    const mcpManager = getMcpServerManager();
    const steps = skill.steps as unknown as SkillStep[];

    console.log(`[Skill Hooks] Updating MCP servers for skill ${skill.name}`);

    // Recreate step-level MCP servers for all steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const allowedTools = step.allowedTools || [];

      const toolkits = extractToolkits(allowedTools);

      if (toolkits.length > 0) {
        console.log(`[Skill Hooks]   Step ${i}: Recreating MCP`);
        // Delete existing and create new
        await mcpManager.createStepMcp(skill.id, i, allowedTools);
      } else {
        console.log(`[Skill Hooks]   Step ${i}: No Composio tools, deleting MCP if exists`);
        await mcpManager.deleteStepMcp(skill.id, i);
      }
    }

    console.log(`[Skill Hooks] ✓ MCP servers updated for skill ${skill.name}`);
  } catch (error) {
    console.error('[Composio] Failed to regenerate MCP configs for skill:', error);
  }
}

/**
 * Hook to call before skill is deleted
 */
export async function beforeSkillDeleted(skillId: string): Promise<void> {
  if (!isComposioAvailable()) {
    return;
  }

  try {
    const mcpManager = getMcpServerManager();

    console.log(`[Skill Hooks] Deleting MCP servers for skill ${skillId}`);

    // Find all step MCPs for this skill and delete them
    // We don't know how many steps, so we'll try to delete all possible step indexes
    // The database will tell us which ones exist
    const prisma = (await import('../../db/client.js')).default;
    const stepMcps = await prisma.composioStepMcp.findMany({
      where: { skillId },
    });

    for (const stepMcp of stepMcps) {
      await mcpManager.deleteStepMcp(skillId, stepMcp.stepOrder);
    }

    console.log(`[Skill Hooks] ✓ Deleted ${stepMcps.length} MCP server(s) for skill ${skillId}`);
  } catch (error) {
    console.error('[Composio] Failed to delete MCP configs for skill:', error);
  }
}
