/**
 * Composio Graceful Degradation
 *
 * Helpers for handling cases where Composio is not available
 */

import { isComposioAvailable } from './client.js';
import { getComposioDatabase } from './database.js';
import type { WorkflowStep } from '../../types.js';

/**
 * Check if a step requires Composio
 */
export function doesStepRequireComposio(step: WorkflowStep): boolean {
  if (!step.allowedTools) {
    return false;
  }

  // Check if any tool is a Composio tool (TOOLKIT_ACTION format)
  return step.allowedTools.some(tool => /^[A-Z]+_[A-Z_]+$/.test(tool));
}

/**
 * Validate skill can run without Composio
 */
export function validateSkillWithoutComposio(skill: any): {
  canRun: boolean;
  missingSteps: number[];
} {
  if (isComposioAvailable()) {
    return { canRun: true, missingSteps: [] };
  }

  const steps = skill.steps as WorkflowStep[];
  const missingSteps: number[] = [];

  for (const step of steps) {
    if (doesStepRequireComposio(step)) {
      missingSteps.push(step.id);
    }
  }

  return {
    canRun: missingSteps.length === 0,
    missingSteps,
  };
}

/**
 * Get fallback connections for Composio connections
 */
export async function getFallbackConnections(
  connectionNames: string[]
): Promise<string[]> {
  if (!isComposioAvailable()) {
    return connectionNames; // Return all if Composio not available
  }

  // Return only non-Composio connections
  const db = getComposioDatabase();
  const allConnections = await db.getComposioConnections();
  const composioNames = new Set(allConnections.map(c => c.name));

  return connectionNames.filter(name => !composioNames.has(name));
}
