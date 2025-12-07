/**
 * Composio Database Operations
 *
 * Database operations facade for Composio-related data
 */

import { getPrismaClient } from '../../db/client.js';
import type { ComposioToolkit, Connection } from '@prisma/client';

const prisma = getPrismaClient();

export class ComposioDatabase {
  // ============== Toolkit Cache ==============

  async syncToolkits(toolkits: Omit<ComposioToolkit, 'lastSynced'>[]): Promise<void> {
    // Upsert all toolkits in a transaction
    await prisma.$transaction(
      toolkits.map(toolkit =>
        prisma.composioToolkit.upsert({
          where: { name: toolkit.name },
          update: {
            displayName: toolkit.displayName,
            description: toolkit.description,
            category: toolkit.category,
            logoUrl: toolkit.logoUrl,
            authScheme: toolkit.authScheme,
            tools: toolkit.tools,
            lastSynced: new Date(),
          },
          create: {
            ...toolkit,
            lastSynced: new Date(),
          },
        })
      )
    );
  }

  async getCachedToolkits(): Promise<ComposioToolkit[]> {
    return prisma.composioToolkit.findMany({
      orderBy: { displayName: 'asc' },
    });
  }

  async searchToolkits(query: string): Promise<ComposioToolkit[]> {
    return prisma.composioToolkit.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { displayName: 'asc' },
    });
  }

  async shouldRefreshToolkits(cacheHours: number = 24): Promise<boolean> {
    const latest = await prisma.composioToolkit.findFirst({
      orderBy: { lastSynced: 'desc' },
    });

    if (!latest) return true;

    const cacheAge = Date.now() - latest.lastSynced.getTime();
    const cacheLimit = cacheHours * 60 * 60 * 1000;

    return cacheAge > cacheLimit;
  }

  // ============== Composio Connections ==============

  async createComposioConnection(params: {
    name: string;
    composioAccountId: string;
    composioToolkit: string;
    tools: string[];
    authStatus: 'active' | 'needs_auth' | 'expired' | 'failed';
  }): Promise<Connection> {
    return prisma.connection.create({
      data: {
        name: params.name,
        type: 'composio',
        source: 'composio',
        composioAccountId: params.composioAccountId,
        composioToolkit: params.composioToolkit,
        tools: params.tools,
        config: {}, // No local config needed for Composio
        authStatus: params.authStatus,
        isActive: params.authStatus === 'active',
      },
    });
  }

  async updateConnectionAuthStatus(
    connectionId: string,
    status: 'active' | 'needs_auth' | 'expired' | 'failed'
  ): Promise<void> {
    await prisma.connection.update({
      where: { id: connectionId },
      data: { authStatus: status },
    });
  }

  async getComposioConnections(): Promise<Connection[]> {
    return prisma.connection.findMany({
      where: { source: 'composio' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnectionByComposioAccountId(accountId: string): Promise<Connection | null> {
    return prisma.connection.findFirst({
      where: { composioAccountId: accountId },
    });
  }

  // ============== MCP Configs ==============

  async createMcpConfig(params: {
    skillId: string;
    stepOrder: number;
    mcpConfigId: string;
    toolkits: string[];
    allowedTools: string[];
  }) {
    return prisma.composioMcpConfig.create({
      data: params,
    });
  }

  async getMcpConfigForStep(skillId: string, stepOrder: number) {
    return prisma.composioMcpConfig.findUnique({
      where: {
        skillId_stepOrder: {
          skillId,
          stepOrder,
        },
      },
    });
  }

  async getMcpConfigsForSkill(skillId: string) {
    return prisma.composioMcpConfig.findMany({
      where: { skillId },
      orderBy: { stepOrder: 'asc' },
    });
  }

  async deleteMcpConfigsForSkill(skillId: string) {
    await prisma.composioMcpConfig.deleteMany({
      where: { skillId },
    });
  }

  async deleteMcpConfigForStep(skillId: string, stepOrder: number) {
    await prisma.composioMcpConfig.delete({
      where: {
        skillId_stepOrder: {
          skillId,
          stepOrder,
        },
      },
    });
  }
}

// SINGLETON: Export singleton instance
let composioDbInstance: ComposioDatabase | null = null;

export function getComposioDatabase(): ComposioDatabase {
  if (!composioDbInstance) {
    composioDbInstance = new ComposioDatabase();
  }
  return composioDbInstance;
}
