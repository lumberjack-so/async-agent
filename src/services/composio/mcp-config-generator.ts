/**
 * Composio MCP Config Generator
 *
 * Automatically generates and manages Composio MCP configurations for workflow steps
 */

import { getComposioClient } from './client.js';
import { getComposioDatabase } from './database.js';
import { extractToolkits } from './utils.js';
import type { WorkflowStep } from '../../types.js';
import type { Skill } from '@prisma/client';

export class ComposioMcpConfigGenerator {
  private client = getComposioClient();
  private db = getComposioDatabase();

  /**
   * Generate MCP configs for all steps in a skill
   */
  async generateConfigsForSkill(skill: Skill): Promise<void> {
    const steps = skill.steps as unknown as WorkflowStep[];

    for (const step of steps) {
      await this.generateConfigForStep(skill.id, step);
    }
  }

  /**
   * Generate MCP config for a single step
   */
  async generateConfigForStep(skillId: string, step: WorkflowStep): Promise<void> {
    // Skip if no tools specified
    if (!step.allowedTools || step.allowedTools.length === 0) {
      return;
    }

    // Extract toolkits from tool names
    const toolkits = extractToolkits(step.allowedTools);

    if (toolkits.length === 0) {
      return;
    }

    // Check if config already exists
    const existingConfig = await this.db.getMcpConfigForStep(skillId, step.id);

    // Delete old config if exists
    if (existingConfig) {
      try {
        await this.client.deleteMcpConfig(existingConfig.mcpConfigId);
      } catch (error) {
        console.error(`[Composio] Failed to delete old MCP config:`, error);
      }
      await this.db.deleteMcpConfigForStep(skillId, step.id);
    }

    // Create new MCP config
    const mcpConfig = await this.client.createMcpConfig({
      name: `skill-${skillId}-step-${step.id}`,
      toolkits: toolkits.map(toolkit => ({
        toolkit,
        // Use managed auth (no authConfig needed)
      })),
      allowedTools: step.allowedTools,
    });

    // Save to database
    await this.db.createMcpConfig({
      skillId,
      stepOrder: step.id,
      mcpConfigId: mcpConfig.id,
      toolkits,
      allowedTools: step.allowedTools,
    });
  }

  /**
   * Delete all MCP configs for a skill
   */
  async deleteConfigsForSkill(skillId: string): Promise<void> {
    const configs = await this.db.getMcpConfigsForSkill(skillId);

    for (const config of configs) {
      try {
        await this.client.deleteMcpConfig(config.mcpConfigId);
      } catch (error) {
        console.error(`[Composio] Failed to delete MCP config ${config.mcpConfigId}:`, error);
      }
    }

    await this.db.deleteMcpConfigsForSkill(skillId);
  }

  /**
   * Regenerate configs when skill is updated
   */
  async regenerateConfigsForSkill(skill: Skill): Promise<void> {
    await this.deleteConfigsForSkill(skill.id);
    await this.generateConfigsForSkill(skill);
  }
}

// SINGLETON: Export singleton instance
let mcpConfigGeneratorInstance: ComposioMcpConfigGenerator | null = null;

export function getMcpConfigGenerator(): ComposioMcpConfigGenerator {
  if (!mcpConfigGeneratorInstance) {
    mcpConfigGeneratorInstance = new ComposioMcpConfigGenerator();
  }
  return mcpConfigGeneratorInstance;
}
