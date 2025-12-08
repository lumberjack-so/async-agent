#!/usr/bin/env node
/**
 * Seed Email Digest Skill
 */

import dotenv from 'dotenv';
dotenv.config({ path: '/Users/Shared/dev/async-agent/.env' });

import { PrismaClient } from '@prisma/client';
import { afterSkillCreated } from './dist/services/composio/skill-hooks.js';

const prisma = new PrismaClient();

async function seedDigestSkill() {
  console.log('🌱 Seeding Email Digest skill...\n');

  const skill = await prisma.skill.create({
    data: {
      name: 'Email Digest',
      description: 'Creates and sends a digest of unread emails',
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
          prompt: 'Analyze the email content and draft a digest',
          guidance: 'Create a digest based on the emails contents',
          allowedTools: ['Read', 'Write'],
        },
        {
          id: 3,
          prompt: 'Send the drafted digest summary via Gmail to david@sabo.tech',
          guidance: 'Use Gmail to send the digest email to david@sabo.tech',
          allowedTools: ['GMAIL_SEND_EMAIL', 'Read'],
        },
      ],
    },
  });

  console.log(`✓ Created skill: ${skill.name} (${skill.id})\n`);
  console.log('Steps:');
  console.log('  Step 1: Search unread emails (GMAIL_SEARCH_EMAILS, GMAIL_GET_EMAIL)');
  console.log('  Step 2: Draft digest (Read, Write)');
  console.log('  Step 3: Send digest to david@sabo.tech (GMAIL_SEND_EMAIL, Read)\n');

  console.log('Calling afterSkillCreated hook...\n');
  await afterSkillCreated(skill);

  console.log('\n✅ Email Digest skill created with step MCPs!\n');
}

seedDigestSkill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
