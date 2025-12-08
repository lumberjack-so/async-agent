#!/usr/bin/env node
/**
 * Backfill Step MCPs
 * Creates step-level custom MCP servers for existing skills
 */

import dotenv from 'dotenv';
dotenv.config();

import { afterSkillCreated } from './dist/services/composio/skill-hooks.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillStepMcps() {
  console.log('🔄 Backfilling Step MCPs for existing skills...\n');

  // Get all skills
  const skills = await prisma.skill.findMany({
    where: { isActive: true },
  });

  if (skills.length === 0) {
    console.log('No skills found.');
    return;
  }

  console.log(`Found ${skills.length} skill(s):\n`);

  for (const skill of skills) {
    try {
      console.log(`Processing: ${skill.name}`);

      // Call the skill hooks to create step MCPs
      await afterSkillCreated(skill);

      console.log(`✓ Step MCPs created for "${skill.name}"\n`);
    } catch (error) {
      console.error(`✗ Failed to create step MCPs for "${skill.name}":`, error.message);
      if (error.response?.data) {
        console.error(`  API Error:`, JSON.stringify(error.response.data, null, 2));
      }
      console.error();
    }
  }

  console.log('✅ Backfill complete!\n');
}

backfillStepMcps()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
