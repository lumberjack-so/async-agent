#!/usr/bin/env node
/**
 * Test Add Connection Flow
 * Simulates the full connection add flow with verbose error logging
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { getMcpServerManager } from './dist/services/composio/mcp-server-manager.js';
import { getComposioDatabase } from './dist/services/composio/database.js';

const prisma = new PrismaClient();

async function testAddConnection() {
  console.log('🧪 Testing Add Connection Flow\n');

  // Simulate what happens after connection is created
  const toolkit = 'gmail';
  console.log(`1. Connection would be created in database for toolkit: ${toolkit}\n`);

  // This is what the add.js command does (lines 90-101)
  console.log('2. Creating MCP server...\n');
  try {
    const mcpManager = getMcpServerManager();
    console.log('   ✓ MCP Manager instantiated');

    const mcpResult = await mcpManager.getOrCreateToolkitMcp(toolkit);
    console.log(`   ✓ MCP server created: ${mcpResult.mcpServerId}`);
    console.log(`   ✓ MCP URL: ${mcpResult.mcpUrl}`);
    console.log(`   ✓ MCP tools available: ${mcpResult.tools.length}\n`);

    console.log('3. Verifying in database...\n');
    const dbRecord = await prisma.composioToolkitMcp.findUnique({
      where: { toolkit },
    });

    if (dbRecord) {
      console.log('   ✓ Found in database:');
      console.log(`     - Toolkit: ${dbRecord.toolkit}`);
      console.log(`     - MCP Server ID: ${dbRecord.mcpServerId}`);
      console.log(`     - URL: ${dbRecord.mcpUrl}`);
      console.log(`     - Tools: ${dbRecord.tools.length}`);
    } else {
      console.log('   ✗ NOT found in database!');
    }

  } catch (error) {
    console.error('\n❌ Failed to create MCP server:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    if (error.response?.data) {
      console.error('\nAPI Response:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testAddConnection()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
