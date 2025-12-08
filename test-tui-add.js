#!/usr/bin/env node
/**
 * Test TUI addConnection function directly
 */

import dotenv from 'dotenv';
dotenv.config({ path: '/Users/Shared/dev/async-agent/.env' });

import chalk from 'chalk';

async function testAddConnection() {
  console.log('🧪 Testing TUI addConnection code path\n');

  // Simulate what TUI does
  const toolkit = {
    name: 'gmail',
    displayName: 'Gmail',
    tools: ['GMAIL_SEND_EMAIL', 'GMAIL_CREATE_EMAIL_DRAFT'],
  };

  console.log('1. Simulating connection creation...');

  // Skip actual API call, just test the MCP hook part
  console.log('2. Testing MCP creation hook...\n');

  console.log(chalk.gray('Creating MCP server...'));
  try {
    const { getMcpServerManager } = await import('./dist/services/composio/mcp-server-manager.js');
    console.log('   ✓ Imported getMcpServerManager');

    const mcpManager = getMcpServerManager();
    console.log('   ✓ Got MCP manager instance');

    const mcpResult = await mcpManager.getOrCreateToolkitMcp(toolkit.name);
    console.log(chalk.green(`   ✓ MCP server created: ${mcpResult.mcpServerId}`));
    console.log(chalk.gray(`   ✓ MCP tools available: ${mcpResult.tools.length}\n`));

    console.log('\n✅ TUI MCP hook is working!\n');
  } catch (error) {
    console.warn(chalk.yellow('   ⚠ Failed to create MCP server'));
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testAddConnection().catch(console.error);
