/**
 * Composio Skill Lifecycle Hooks
 *
 * Hooks to call after skill creation/update/deletion for MCP config management
 */

import { getMcpConfigGenerator } from './mcp-config-generator.js';
import { isComposioAvailable } from './client.js';
import type { Skill } from '@prisma/client';

/**
 * Hook to call after skill is created
 */
export async function afterSkillCreated(skill: Skill): Promise<void> {
  if (!isComposioAvailable()) {
    return; // Graceful degradation
  }

  try {
    const generator = getMcpConfigGenerator();
    await generator.generateConfigsForSkill(skill);
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
    const generator = getMcpConfigGenerator();
    await generator.regenerateConfigsForSkill(skill);
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
    const generator = getMcpConfigGenerator();
    await generator.deleteConfigsForSkill(skillId);
  } catch (error) {
    console.error('[Composio] Failed to delete MCP configs for skill:', error);
  }
}
