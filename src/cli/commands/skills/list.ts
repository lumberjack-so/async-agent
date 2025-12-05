/**
 * Skills List Command
 * Agent 4 will implement this
 */

import { db } from '../../lib/db.js';
import { formatters } from '../../lib/formatters.js';
import { ListCommandOptions } from '../../types.js';

export async function listSkillsCommand(options: ListCommandOptions) {
  try {
    // Determine filter based on options
    let filterOptions: { active?: boolean } | undefined;
    if (options.active) {
      filterOptions = { active: true };
    } else if (options.inactive) {
      filterOptions = { active: false };
    }

    // Get skills from database
    const skills = await db.listSkills(filterOptions);

    // Output as JSON or formatted table
    if (options.json) {
      console.log(JSON.stringify(skills, null, 2));
    } else {
      console.log(formatters.formatSkillTable(skills));
    }
  } catch (error) {
    console.error(formatters.formatError(error as Error));
    process.exit(1);
  }
}
