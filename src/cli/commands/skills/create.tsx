/**
 * Skills Create Command (TUI)
 * Agent 9 will implement this
 */

import React from 'react';
import { render } from 'ink';
import { SkillBuilder } from '../../components/SkillBuilder.js';
import { db } from '../../lib/db.js';
import { formatters } from '../../lib/formatters.js';
import chalk from 'chalk';

export async function createSkillCommand() {
  const { waitUntilExit } = render(
    <SkillBuilder
      onSave={async (skillData) => {
        try {
          const created = await db.createSkill(skillData);
          console.log(chalk.green(`\n✓ Skill "${created.name}" created successfully!`));
          console.log(chalk.gray(`ID: ${created.id.substring(0, 8)}\n`));
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
