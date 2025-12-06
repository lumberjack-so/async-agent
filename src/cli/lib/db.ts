/**
 * Database Layer - Prisma Wrappers
 * Agent 1 implementation: Database CRUD operations for skills
 */

import prisma from '../../db/client.js';
import { DatabaseClient, ListSkillsOptions, SkillCreateInput, SkillUpdateInput } from '../types.js';
import { afterSkillCreated, afterSkillUpdated, beforeSkillDeleted } from '../../services/composio/skill-hooks.js';

export const db: DatabaseClient = {
  async listSkills(options?: ListSkillsOptions) {
    try {
      return await prisma.skill.findMany({
        where: options?.active !== undefined ? { isActive: options.active } : undefined,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      throw new Error(
        `Failed to list skills: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async getSkill(id: string) {
    try {
      const skill = await prisma.skill.findUnique({
        where: { id },
      });
      return skill || null;
    } catch (error) {
      throw new Error(
        `Failed to get skill: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async createSkill(data: SkillCreateInput) {
    try {
      const skill = await prisma.skill.create({
        data: {
          name: data.name,
          description: data.description,
          triggerType: data.triggerType,
          steps: data.steps as any,
          connectionNames: data.connectionNames || [],
          isActive: data.isActive,
          isSystem: false,
        },
      });

      // Call Composio hook (non-blocking, graceful degradation)
      afterSkillCreated(skill).catch(err =>
        console.warn('[Composio] Hook failed:', err.message)
      );

      return skill;
    } catch (error) {
      throw new Error(
        `Failed to create skill: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async updateSkill(id: string, data: SkillUpdateInput) {
    try {
      const skill = await prisma.skill.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.triggerType !== undefined && { triggerType: data.triggerType }),
          ...(data.steps !== undefined && { steps: data.steps as any }),
          ...(data.connectionNames !== undefined && { connectionNames: data.connectionNames }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      // Call Composio hook (non-blocking, graceful degradation)
      afterSkillUpdated(skill).catch(err =>
        console.warn('[Composio] Hook failed:', err.message)
      );

      return skill;
    } catch (error) {
      throw new Error(
        `Failed to update skill: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async deleteSkill(id: string) {
    try {
      // Call Composio hook before deletion (non-blocking, graceful degradation)
      await beforeSkillDeleted(id).catch(err =>
        console.warn('[Composio] Hook failed:', err.message)
      );

      await prisma.skill.delete({
        where: { id },
      });
    } catch (error) {
      throw new Error(
        `Failed to delete skill: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
};
