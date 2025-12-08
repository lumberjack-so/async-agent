#!/usr/bin/env node
/**
 * Seed Test Skill with Composio Tools
 * Creates a skill that uses Gmail tools to test step MCP creation
 */

import dotenv from 'dotenv';
dotenv.config({ path: '/Users/Shared/dev/async-agent/.env' });

import { PrismaClient } from '@prisma/client';
import { afterSkillCreated } from './dist/services/composio/skill-hooks.js';

const prisma = new PrismaClient();

async function seedTestSkill() {
  console.log('🌱 Seeding test skill with Composio tools...\n');

  const skill = await prisma.skill.create({
    data: {
      name: 'Email Responder',
      description: 'Reads emails and sends automated responses',
      triggerType: 'manual',
      isActive: true,
      isSystem: false,
      connectionNames: ['Gmail'],
      steps: [
        {
          id: 1,
          prompt: 'Search for unread emails in my inbox',
          guidance: 'Find the most recent unread emails',
          allowedTools: ['GMAIL_SEARCH_EMAILS', 'GMAIL_GET_EMAIL'],
        },
        {
          id: 2,
          prompt: 'Analyze the email content and draft a response',
          guidance: 'Create an appropriate response based on the email content',
          allowedTools: ['Read', 'Write'],
        },
        {
          id: 3,
          prompt: 'Send the drafted response via Gmail',
          guidance: 'Use Gmail to send the response email',
          allowedTools: ['GMAIL_SEND_EMAIL', 'Read'],
        },
      ],
    },
  });

  console.log(`✓ Created skill: ${skill.name} (${skill.id})\n`);
  console.log('Steps:');
  console.log('  Step 1: Uses GMAIL_SEARCH_EMAILS, GMAIL_GET_EMAIL');
  console.log('  Step 2: Uses SDK tools only (Read, Write)');
  console.log('  Step 3: Uses GMAIL_SEND_EMAIL, Read\n');

  console.log('Now calling afterSkillCreated hook to generate step MCPs...\n');

  // Call the skill creation hook
  await afterSkillCreated(skill);

  console.log('\n✅ Done! Check database for step MCPs.\n');
}

seedTestSkill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
