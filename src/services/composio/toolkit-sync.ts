/**
 * Composio Toolkit Sync Service
 *
 * Syncs all available toolkits from Composio API to local database
 * Runs on installation and periodically on startup
 */

import { getComposioClient, isComposioAvailable } from './client.js';
import { getComposioDatabase } from './database.js';
import { config } from '../../config/index.js';
import type { ComposioToolkit } from '../../types/composio.js';

export class ToolkitSyncService {
  /**
   * Sync toolkits from Composio API to database
   * @param force Force sync even if cache is fresh
   */
  async syncToolkits(force: boolean = false): Promise<{
    synced: boolean;
    count: number;
    message: string;
  }> {
    if (!isComposioAvailable()) {
      return {
        synced: false,
        count: 0,
        message: 'Composio integration is not enabled',
      };
    }

    try {
      const db = getComposioDatabase();
      const client = getComposioClient();

      // Check if we need to refresh
      const shouldRefresh = await db.shouldRefreshToolkits(
        config.composio.cacheToolkitListHours
      );

      if (!shouldRefresh && !force) {
        const cached = await db.getCachedToolkits();
        return {
          synced: false,
          count: cached.length,
          message: `Using cached toolkits (${cached.length} available)`,
        };
      }

      console.log('[Composio] Syncing toolkits from API...');

      // Fetch all toolkits from Composio
      const toolkits = await client.listToolkits();

      if (toolkits.length === 0) {
        return {
          synced: false,
          count: 0,
          message: 'No toolkits found from Composio API',
        };
      }

      // Transform API response to database format
      const toolkitsToSync = toolkits.map((toolkit) => ({
        name: toolkit.name,
        displayName: toolkit.displayName,
        description: toolkit.description,
        category: toolkit.category,
        logoUrl: toolkit.logoUrl || null,
        authScheme: toolkit.authScheme,
        tools: toolkit.tools || [],
      }));

      // Sync to database
      await db.syncToolkits(toolkitsToSync);

      console.log(`[Composio] ✓ Synced ${toolkits.length} toolkits`);

      return {
        synced: true,
        count: toolkits.length,
        message: `Successfully synced ${toolkits.length} toolkits`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Composio] Failed to sync toolkits:', message);

      return {
        synced: false,
        count: 0,
        message: `Failed to sync toolkits: ${message}`,
      };
    }
  }

  /**
   * Get toolkit by name from cache
   */
  async getToolkit(name: string) {
    if (!isComposioAvailable()) {
      return null;
    }

    const db = getComposioDatabase();
    const toolkits = await db.getCachedToolkits();
    return toolkits.find((t) => t.name === name) || null;
  }

  /**
   * Search toolkits by query
   */
  async searchToolkits(query: string) {
    if (!isComposioAvailable()) {
      return [];
    }

    const db = getComposioDatabase();
    return db.searchToolkits(query);
  }

  /**
   * Get all cached toolkits
   */
  async getAllToolkits() {
    if (!isComposioAvailable()) {
      return [];
    }

    const db = getComposioDatabase();
    return db.getCachedToolkits();
  }

  /**
   * Get toolkits grouped by category
   */
  async getToolkitsByCategory() {
    const toolkits = await this.getAllToolkits();

    return toolkits.reduce((acc, toolkit) => {
      const category = toolkit.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(toolkit);
      return acc;
    }, {} as Record<string, any[]>);
  }
}

// SINGLETON: Export singleton instance
let toolkitSyncInstance: ToolkitSyncService | null = null;

export function getToolkitSyncService(): ToolkitSyncService {
  if (!toolkitSyncInstance) {
    toolkitSyncInstance = new ToolkitSyncService();
  }
  return toolkitSyncInstance;
}

/**
 * Helper function to sync toolkits (used in scripts and startup)
 */
export async function syncToolkitsIfNeeded(force: boolean = false): Promise<void> {
  if (!isComposioAvailable()) {
    return;
  }

  const service = getToolkitSyncService();
  const result = await service.syncToolkits(force);

  if (result.synced) {
    console.log(`[Composio] ${result.message}`);
  }
}
