/**
 * Add Composio Connection Command
 *
 * Add a new Composio connection via CLI
 */

import chalk from 'chalk';
import { getComposioClient, isComposioAvailable } from '../../../services/composio/client.js';
import { getComposioDatabase } from '../../../services/composio/database.js';

export async function addConnectionCommand(toolkitName: string) {
  try {
    if (!isComposioAvailable()) {
      console.error(chalk.red('✗ Composio integration is not enabled'));
      console.log(chalk.gray('Set COMPOSIO_API_KEY in your environment to enable Composio features'));
      process.exit(1);
    }

    const client = getComposioClient();
    const db = getComposioDatabase();

    console.log(chalk.cyan(`Adding connection for toolkit: ${toolkitName}`));

    // Get toolkit info
    let toolkit;
    try {
      toolkit = await client.getToolkit(toolkitName);
    } catch (error) {
      console.error(chalk.red(`✗ Toolkit not found: ${toolkitName}`));
      console.log(chalk.gray('Run `alfred connections` to browse available toolkits'));
      process.exit(1);
    }

    console.log(chalk.gray(`Toolkit: ${toolkit.displayName}`));
    console.log(chalk.gray(`Auth scheme: ${toolkit.authScheme}`));

    // Initiate connection
    const authFlow = await client.initiateConnection({
      toolkitName: toolkit.name,
    });

    if (authFlow.type === 'oauth' && authFlow.authUrl) {
      console.log(chalk.yellow('\n📎 Open this URL to authenticate:'));
      console.log(chalk.blue(authFlow.authUrl));
      console.log(chalk.gray('\nWaiting for authentication to complete...'));
      console.log(chalk.gray('(Authentication flow handling will be improved in TUI)'));
    }

    // Get tools for this toolkit
    const tools = await client.getToolkitTools(toolkit.name);

    // Save to database
    if (authFlow.connectionId) {
      await db.createComposioConnection({
        name: toolkit.displayName,
        composioAccountId: authFlow.connectionId,
        composioToolkit: toolkit.name,
        tools,
      });

      console.log(chalk.green(`\n✓ Connection created: ${toolkit.displayName}`));
      console.log(chalk.gray(`Tools available: ${tools.length}`));
    }
  } catch (error) {
    console.error(chalk.red('✗ Failed to add connection'), error);
    process.exit(1);
  }
}
