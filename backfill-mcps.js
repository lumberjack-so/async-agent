#!/usr/bin/env node
/**
 * Backfill Toolkit MCPs
 * Creates toolkit-level MCP servers for existing Composio connections
 */

import dotenv from 'dotenv';
dotenv.config();

import { getMcpServerManager } from './dist/services/composio/mcp-server-manager.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillToolkitMcps() {
  console.log('🔄 Backfilling Toolkit MCPs for existing Composio connections...\n');

  // Get all Composio connections
  const connections = await prisma.connection.findMany({
    where: { type: 'composio' },
  });

  if (connections.length === 0) {
    console.log('No Composio connections found.');
    return;
  }

  console.log(`Found ${connections.length} Composio connection(s):\n`);

  const mcpManager = getMcpServerManager();

  for (const conn of connections) {
    if (!conn.composioToolkit) {
      console.log(`⚠️  Skipping "${conn.name}" - no toolkit specified`);
      continue;
    }

    try {
      console.log(`Processing: ${conn.name} (${conn.composioToolkit})`);

      const result = await mcpManager.getOrCreateToolkitMcp(conn.composioToolkit);

      console.log(`✓ MCP Server ID: ${result.mcpServerId}`);
      console.log(`  URL: ${result.mcpUrl}`);
      console.log(`  Tools: ${result.tools.length}\n`);
    } catch (error) {
      console.error(`✗ Failed to create MCP for "${conn.name}":`, error.message);
      if (error.response?.data) {
        console.error(`  API Error:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(`  ${error}\n`);
      }
    }
  }

  console.log('✅ Backfill complete!\n');
}

backfillToolkitMcps()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
