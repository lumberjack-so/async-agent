#!/usr/bin/env node
/**
 * Quick Database Browser
 * Shows key tables in a readable format
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function browseDatabse() {
  console.log('📊 Database Browser\n');
  console.log('='.repeat(80));

  // Show Composio Connections
  console.log('\n🔗 Composio Connections:');
  const connections = await prisma.connection.findMany({
    where: { type: 'composio' },
    select: {
      name: true,
      composioToolkit: true,
      authStatus: true,
      tools: true,
      createdAt: true,
    },
  });

  if (connections.length === 0) {
    console.log('  No Composio connections found');
  } else {
    connections.forEach((conn, i) => {
      console.log(`\n  ${i + 1}. ${conn.name}`);
      console.log(`     Toolkit: ${conn.composioToolkit}`);
      console.log(`     Status: ${conn.authStatus}`);
      console.log(`     Tools: ${conn.tools?.length || 0} tools`);
      console.log(`     Created: ${conn.createdAt.toISOString()}`);
    });
  }

  // Show Toolkit MCPs
  console.log('\n\n🛠️  Toolkit-Level MCP Servers:');
  const toolkitMcps = await prisma.composioToolkitMcp.findMany();

  if (toolkitMcps.length === 0) {
    console.log('  No toolkit MCPs found');
  } else {
    toolkitMcps.forEach((mcp, i) => {
      console.log(`\n  ${i + 1}. ${mcp.toolkit}`);
      console.log(`     MCP Server ID: ${mcp.mcpServerId}`);
      console.log(`     URL: ${mcp.mcpUrl}`);
      console.log(`     Tools: ${mcp.tools.length}`);
      console.log(`     Created: ${mcp.createdAt.toISOString()}`);
    });
  }

  // Show Step MCPs
  console.log('\n\n📋 Step-Level Custom MCP Servers:');
  const stepMcps = await prisma.composioStepMcp.findMany();

  if (stepMcps.length === 0) {
    console.log('  No step MCPs found');
  } else {
    for (const mcp of stepMcps) {
      const skill = await prisma.skill.findUnique({
        where: { id: mcp.skillId },
        select: { name: true },
      });

      console.log(`\n  Step ${mcp.stepOrder} of "${skill?.name || mcp.skillId}"`);
      console.log(`     MCP Server ID: ${mcp.mcpServerId}`);
      console.log(`     URL: ${mcp.mcpUrl}`);
      console.log(`     Allowed Tools: ${mcp.allowedTools.length}`);
      console.log(`     Auth Config IDs: ${mcp.authConfigIds.join(', ')}`);
      console.log(`     Created: ${mcp.createdAt.toISOString()}`);
    }
  }

  // Show Skills
  console.log('\n\n🎯 Skills:');
  const skills = await prisma.skill.findMany({
    select: {
      name: true,
      triggerType: true,
      connectionNames: true,
      runCount: true,
      isActive: true,
    },
  });

  if (skills.length === 0) {
    console.log('  No skills found');
  } else {
    skills.forEach((skill, i) => {
      console.log(`\n  ${i + 1}. ${skill.name}`);
      console.log(`     Trigger: ${skill.triggerType}`);
      console.log(`     Connections: ${skill.connectionNames.join(', ') || 'none'}`);
      console.log(`     Run Count: ${skill.runCount}`);
      console.log(`     Active: ${skill.isActive ? 'Yes' : 'No'}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 Tip: Run "npx prisma studio" for a visual database browser\n');
}

browseDatabse()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
