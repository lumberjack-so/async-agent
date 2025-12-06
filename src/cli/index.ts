#!/usr/bin/env node
/**
 * Alfred CLI - Main Entry Point
 * Manages the async-agent system from the command line
 */

// MUST be imported first to load environment variables
import './dotenv-init.js';

import { Command } from 'commander';
import chalk from 'chalk';
import { listSkillsCommand } from './commands/skills/list.js';
import { viewSkillCommand } from './commands/skills/view.js';
import { createSkillCommand } from './commands/skills/create.js';
import { editSkillCommand } from './commands/skills/edit.js';
import { deleteSkillCommand } from './commands/skills/delete.js';
import { runCommand } from './commands/run.js';
import { healthCommand } from './commands/health.js';
import { versionCommand } from './commands/version.js';
import { modelConfigCommand } from './commands/config/model.js';
import { tuiCommand } from './commands/tui.js';
import { createConnectionsCommand } from './commands/connections/index.js';

const program = new Command();

program
  .name('alfred')
  .description('Manage your async agent system')
  .version('1.0.0')
  .action(async () => {
    // If no command specified, launch TUI mode
    await tuiCommand();
  });

// ============================================
// SKILLS COMMANDS
// ============================================

const skills = program.command('skills').description('Manage skills');

skills
  .command('list')
  .description('List all skills')
  .option('--active', 'Show only active skills')
  .option('--inactive', 'Show only inactive skills')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await listSkillsCommand(options);
  });

skills
  .command('view <id>')
  .description('View skill details')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await viewSkillCommand(id, options);
  });

skills
  .command('create')
  .description('Create new skill (interactive)')
  .action(async () => {
    await createSkillCommand();
  });

skills
  .command('edit <id>')
  .description('Edit existing skill (interactive)')
  .action(async (id) => {
    await editSkillCommand(id);
  });

skills
  .command('delete <id>')
  .description('Delete skill')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (id, options) => {
    await deleteSkillCommand(id, options);
  });

// ============================================
// CONNECTIONS COMMANDS (Composio)
// ============================================

program.addCommand(createConnectionsCommand());

// ============================================
// CONFIG COMMANDS
// ============================================

const config = program.command('config').description('Manage configuration');

config
  .command('model <action> [value]')
  .description('Get or set the model (action: get|set)')
  .action(async (action, value) => {
    await modelConfigCommand(action, value);
  });

// ============================================
// RUN COMMAND
// ============================================

program
  .command('run <prompt>')
  .description('Send task to alfred')
  .option('--mode <mode>', 'Execution mode (classifier|orchestrator|default)')
  .option('--async', 'Run asynchronously')
  .option('--request-id <id>', 'Custom request ID')
  .option('--metadata <json>', 'Additional metadata (JSON string)')
  .option('--json', 'Output as JSON')
  .action(async (prompt, options) => {
    await runCommand(prompt, options);
  });

// ============================================
// HEALTH COMMAND
// ============================================

program
  .command('health')
  .description('Check system health')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await healthCommand(options);
  });

// ============================================
// VERSION COMMAND
// ============================================

program
  .command('version')
  .description('Show version information')
  .action(async () => {
    await versionCommand();
  });

// ============================================
// TUI COMMAND
// ============================================

program
  .command('tui')
  .description('Launch interactive TUI mode (default)')
  .action(async () => {
    await tuiCommand();
  });

program.parse();
