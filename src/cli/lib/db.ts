/**
 * Database Layer - Prisma Wrappers
 * Agent 1 implementation: Database CRUD operations for skills
 */

import prisma from '../../db/client.js';
import { DatabaseClient, ListSkillsOptions, SkillCreateInput, SkillUpdateInput } from '../types.js';

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
      return await prisma.skill.create({
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
    } catch (error) {
      throw new Error(
        `Failed to create skill: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async updateSkill(id: string, data: SkillUpdateInput) {
    try {
      return await prisma.skill.update({
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
    } catch (error) {
      throw new Error(
        `Failed to update skill: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async deleteSkill(id: string) {
    try {
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
