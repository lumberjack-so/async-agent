/**
 * Skills View Command
 * Agent 4 will implement this
 */

import { db } from '../../lib/db.js';
import { formatters } from '../../lib/formatters.js';
import { ViewCommandOptions } from '../../types.js';

export async function viewSkillCommand(id: string, options: ViewCommandOptions) {
  try {
    const skill = await db.getSkill(id);

    if (!skill) {
      throw new Error(`Skill with ID '${id}' not found`);
    }

    // Output as JSON or formatted detail
    if (options.json) {
      console.log(JSON.stringify(skill, null, 2));
    } else {
      console.log(formatters.formatSkillDetail(skill));
    }
  } catch (error) {
    console.error(formatters.formatError(error as Error));
    process.exit(1);
  }
}
