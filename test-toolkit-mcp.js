#!/usr/bin/env node
/**
 * Test Toolkit MCP Creation
 * Tests creating a toolkit MCP for Gmail connection
 */

import dotenv from 'dotenv';
dotenv.config();

import { getMcpServerManager } from './dist/services/composio/mcp-server-manager.js';

async function testToolkitMcp() {
  console.log('🔍 Testing Toolkit MCP Creation\n');

  const mcpManager = getMcpServerManager();

  console.log('Attempting to create/get toolkit MCP for "gmail"...\n');

  try {
    const result = await mcpManager.getOrCreateToolkitMcp('gmail');
    console.log('\n✅ Success!');
    console.log(`MCP Server ID: ${result.mcpServerId}`);
    console.log(`MCP URL: ${result.mcpUrl}`);
    console.log(`Tools: ${result.tools.length}`);
  } catch (error) {
    console.error('\n❌ Failed with error:');
    console.error(error);
    if (error.response?.data) {
      console.error('\nAPI Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testToolkitMcp().catch(console.error);
