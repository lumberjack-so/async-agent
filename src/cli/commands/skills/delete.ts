/**
 * Skills Delete Command
 * Agent 5 will implement this
 */

import { db } from '../../lib/db.js';
import { formatters } from '../../lib/formatters.js';
import { DeleteCommandOptions } from '../../types.js';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

export async function deleteSkillCommand(id: string, options: DeleteCommandOptions) {
  try {
    // Check if skill exists
    const skill = await db.getSkill(id);
    if (!skill) {
      throw new Error(`Skill with ID '${id}' not found`);
    }

    // Confirm deletion (unless --yes flag)
    if (!options.yes) {
      const rl = readline.createInterface({ input, output });
      const answer = await rl.question(`Are you sure you want to delete "${skill.name}"? (y/N): `);
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('Cancelled');
        return;
      }
    }

    // Delete skill
    await db.deleteSkill(id);
    console.log(`\n✓ Skill "${skill.name}" deleted successfully\n`);
  } catch (error) {
    console.error(formatters.formatError(error as Error));
    process.exit(1);
  }
}
