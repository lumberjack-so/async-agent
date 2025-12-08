#!/usr/bin/env node
/**
 * Test Composio Hooks
 * Runs skill creation hooks manually to see actual errors
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { afterSkillCreated } from './dist/services/composio/skill-hooks.js';

const prisma = new PrismaClient();

async function testHooks() {
  console.log('🔍 Testing Composio Hooks\n');

  // Get the most recently created skill
  const skill = await prisma.skill.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!skill) {
    console.log('❌ No skills found in database');
    return;
  }

  console.log(`Testing hook for skill: ${skill.name}`);
  console.log(`Skill ID: ${skill.id}`);
  console.log(`Steps: ${JSON.stringify(skill.steps, null, 2)}\n`);

  console.log('Calling afterSkillCreated hook...\n');

  try {
    await afterSkillCreated(skill);
    console.log('\n✅ Hook completed successfully');
  } catch (error) {
    console.error('\n❌ Hook failed with error:');
    console.error(error);
    if (error.response?.data) {
      console.error('\nAPI Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testHooks()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
