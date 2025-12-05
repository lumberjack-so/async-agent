/**
 * Skills Edit Command (TUI)
 * Agent 9 will implement this
 */

import React from 'react';
import { render } from 'ink';
import { SkillEditor } from '../../components/SkillEditor.js';
import { db } from '../../lib/db.js';
import { formatters } from '../../lib/formatters.js';
import chalk from 'chalk';

export async function editSkillCommand(id: string) {
  // Verify skill exists first
  try {
    const skill = await db.getSkill(id);
    if (!skill) {
      throw new Error(`Skill with ID '${id}' not found`);
    }
  } catch (error) {
    console.error(formatters.formatError(error as Error));
    process.exit(1);
  }

  const { waitUntilExit } = render(
    <SkillEditor
      skillId={id}
      onSave={async (updateData) => {
        try {
          const updated = await db.updateSkill(id, updateData);
          console.log(chalk.green(`\n✓ Skill "${updated.name}" updated successfully!\n`));
          process.exit(0);
        } catch (error) {
          console.error(formatters.formatError(error as Error));
          process.exit(1);
        }
      }}
      onCancel={() => {
        console.log(chalk.yellow('\nCancelled\n'));
        process.exit(0);
      }}
    />
  );

  try {
    await waitUntilExit();
  } catch (error) {
    console.error(formatters.formatError(error as Error));
    process.exit(1);
  }
}
