/**
 * Delete Composio Connection Command
 *
 * Delete a Composio connection by ID
 */

import chalk from 'chalk';
import { getComposioClient, isComposioAvailable } from '../../../services/composio/client.js';
import { getPrismaClient } from '../../../db/client.js';

interface DeleteOptions {
  yes?: boolean;
}

export async function deleteConnectionCommand(
  connectionId: string,
  options: DeleteOptions
) {
  try {
    if (!isComposioAvailable()) {
      console.error(chalk.red('✗ Composio integration is not enabled'));
      process.exit(1);
    }

    const prisma = getPrismaClient();
    const client = getComposioClient();

    // Find connection
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      console.error(chalk.red(`✗ Connection not found: ${connectionId}`));
      process.exit(1);
    }

    if (connection.source !== 'composio') {
      console.error(chalk.red(`✗ Connection is not a Composio connection`));
      process.exit(1);
    }

    // Confirm deletion unless -y flag is set
    if (!options.yes) {
      console.log(chalk.yellow(`Are you sure you want to delete connection "${connection.name}"?`));
      console.log(chalk.gray('This action cannot be undone. Use -y flag to skip this confirmation.'));
      process.exit(0);
    }

    // Delete from Composio
    if (connection.composioAccountId) {
      try {
        await client.deleteConnectedAccount(connection.composioAccountId);
      } catch (error) {
        console.warn(chalk.yellow('⚠ Failed to delete from Composio:'), error);
      }
    }

    // Delete from local database
    await prisma.connection.delete({
      where: { id: connectionId },
    });

    console.log(chalk.green(`✓ Connection deleted: ${connection.name}`));
  } catch (error) {
    console.error(chalk.red('✗ Failed to delete connection'), error);
    process.exit(1);
  }
}
