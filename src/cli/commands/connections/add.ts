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

    if (!authFlow.connectionId) {
      console.error(chalk.red('✗ Failed to initiate connection'));
      process.exit(1);
    }

    if (authFlow.type === 'oauth' && authFlow.authUrl) {
      console.log(chalk.yellow('\n📎 Open this URL to authenticate:'));
      console.log(chalk.blue(authFlow.authUrl));
      console.log(chalk.gray('\nWaiting for authentication to complete...'));
      console.log(chalk.gray('Press Ctrl+C to cancel\n'));

      // Poll for completion (max 5 minutes)
      const maxAttempts = 60; // 5 minutes with 5-second intervals
      let attempts = 0;
      let authComplete = false;

      while (attempts < maxAttempts && !authComplete) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;

        try {
          const status = await client.checkConnectionStatus(authFlow.connectionId);

          if (status === 'active') {
            authComplete = true;
            console.log(chalk.green('✓ Authentication successful!'));
          } else if (status === 'failed') {
            console.error(chalk.red('✗ Authentication failed'));
            process.exit(1);
          }

          // Show progress dots
          process.stdout.write(chalk.gray('.'));
        } catch (error) {
          // Connection might not exist yet, keep polling
          process.stdout.write(chalk.gray('.'));
        }
      }

      if (!authComplete) {
        console.error(chalk.red('\n✗ Authentication timed out after 5 minutes'));
        console.log(chalk.yellow('Please try again or check your Composio dashboard'));
        process.exit(1);
      }
    }

    // Fetch toolkit's tools from Composio API
    console.log(chalk.gray('Fetching toolkit tools...'));
    const tools = await client.getToolkitTools(toolkit.name);
    console.log(chalk.gray(`Found ${tools.length} tools`));

    // Save to database with toolkit's tools
    await db.createComposioConnection({
      name: toolkit.displayName,
      composioAccountId: authFlow.connectionId,
      composioToolkit: toolkit.name,
      tools,
      authStatus: 'active', // If we reached here, auth was successful
    });

    console.log(chalk.green(`\n✓ Connection created: ${toolkit.displayName}`));
    console.log(chalk.gray(`Connection ID: ${authFlow.connectionId}\n`));
  } catch (error) {
    console.error(chalk.red('✗ Failed to add connection'));
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      if (axiosError.response?.data) {
        console.error(chalk.yellow('API Error Details:'), JSON.stringify(axiosError.response.data, null, 2));
      }
    }
    console.error(error);
    process.exit(1);
  }
}
