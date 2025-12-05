/**
 * Database Operations Module
 *
 * Handles Prisma database operations for skills, connections, and executions.
 */

import prisma, { healthCheck } from './db/client.js';

/**
 * Health check - verify Prisma database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    console.log('[DB] Running Prisma health check...');
    const isHealthy = await healthCheck();

    if (isHealthy) {
      console.log('[DB] Prisma health check passed');
    } else {
      console.error('[DB] Prisma health check failed');
    }

    return isHealthy;
  } catch (error) {
    console.error('[DB] Health check exception:', error);
    return false;
  }
}

/**
 * Get all active skills
 */
export async function getAllSkills() {
  try {
    const skills = await prisma.skill.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        triggerType: true,
        steps: true,
        connectionNames: true,
      },
      orderBy: { name: 'asc' },
    });

    console.log(`[DB] Fetched ${skills.length} active skills`);
    return skills;
  } catch (error) {
    console.error('[DB] Failed to fetch skills:', error);
    return [];
  }
}

/**
 * Get skill by ID with full details
 */
export async function getSkillById(id: string) {
  try {
    const skill = await prisma.skill.findUnique({
      where: { id },
      include: { connections: true },
    });

    if (!skill) {
      console.log(`[DB] Skill not found: ${id}`);
      return null;
    }

    console.log(`[DB] Fetched skill: ${skill.name}`);
    return skill;
  } catch (error) {
    console.error('[DB] Failed to fetch skill:', error);
    return null;
  }
}

/**
 * Get connection by name
 */
export async function getConnectionByName(name: string) {
  try {
    const connection = await prisma.connection.findUnique({
      where: { name },
    });

    if (!connection) {
      console.log(`[DB] Connection not found: ${name}`);
      return null;
    }

    console.log(`[DB] Fetched connection: ${connection.name}`);
    return connection;
  } catch (error) {
    console.error('[DB] Failed to fetch connection:', error);
    return null;
  }
}
