/**
 * Model Config Command
 * Agent 5 will implement this
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { validators } from '../../lib/validators.js';
import { formatters } from '../../lib/formatters.js';

const ENV_FILE = path.join(process.cwd(), '.env');

function getModel(): string {
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    const match = content.match(/AGENT_MODEL=(.+)/);
    return match ? match[1].trim() : 'claude-haiku-4-5-20251001';
  } catch {
    return 'claude-haiku-4-5-20251001';
  }
}

function setModel(model: string) {
  let content = '';
  try {
    content = fs.readFileSync(ENV_FILE, 'utf-8');
  } catch {
    // File doesn't exist, create new
  }

  if (content.includes('AGENT_MODEL=')) {
    content = content.replace(/AGENT_MODEL=.+/, `AGENT_MODEL=${model}`);
  } else {
    content += `\nAGENT_MODEL=${model}\n`;
  }

  fs.writeFileSync(ENV_FILE, content);
}

export async function modelConfigCommand(action: string, value?: string) {
  try {
    if (action === 'get') {
      const currentModel = getModel();
      console.log(`\nCurrent model: ${chalk.cyan(currentModel)}\n`);
      console.log('Available models:');
      console.log('  • claude-haiku-4-5-20251001   (fast, cost-effective)');
      console.log('  • claude-sonnet-4-5-20251022  (balanced, recommended)');
      console.log('  • claude-opus-4-5-20251101    (most capable)\n');
    } else if (action === 'set') {
      if (!value) {
        throw new Error('Model value required for set action');
      }

      // Validate model
      const validation = validators.validateModel(value);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setModel(value);
      console.log(`\n✓ Model updated to ${chalk.cyan(value)}\n`);
      console.log(chalk.yellow('Note: Restart alfred server for changes to take effect\n'));
    } else {
      throw new Error('Action must be "get" or "set"');
    }
  } catch (error) {
    console.error(formatters.formatError(error as Error));
    process.exit(1);
  }
}
