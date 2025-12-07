/**
 * List Composio Connections Command
 *
 * Display all Composio connections in table format
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { getComposioClient, isComposioAvailable } from '../../../services/composio/client.js';
import { getComposioDatabase } from '../../../services/composio/database.js';
import { formatAuthStatus, getStatusColor } from '../../../services/composio/utils.js';

interface ListOptions {
  json?: boolean;
}

export async function listConnectionsCommand(options: ListOptions) {
  try {
    if (!isComposioAvailable()) {
      console.error(chalk.red('✗ Connections are not enabled'));
      console.log(chalk.gray('Set COMPOSIO_API_KEY in your environment to enable connections'));
      process.exit(1);
    }

    const db = getComposioDatabase();
    const connections = await db.getComposioConnections();

    if (options.json) {
      console.log(JSON.stringify(connections, null, 2));
      return;
    }

    if (connections.length === 0) {
      console.log(chalk.yellow('No connections found'));
      console.log(chalk.gray('Run `alfred connections add <toolkit>` to add a connection'));
      return;
    }

    const table = new Table({
      head: ['Status', 'Name', 'Toolkit', 'Tools', 'Last Used'],
      style: {
        head: ['cyan'],
      },
    });

    for (const conn of connections) {
      const colorName = getStatusColor(conn.authStatus);
      const status = formatAuthStatus(conn.authStatus);

      // Map color name to chalk function
      const colorFn = colorName === 'green' ? chalk.green :
        colorName === 'yellow' ? chalk.yellow :
          colorName === 'red' ? chalk.red :
            colorName === 'gray' ? chalk.gray :
              chalk.white;

      table.push([
        colorFn(status),
        conn.name,
        conn.composioToolkit || '-',
        conn.tools.length.toString(),
        conn.lastUsedAt ? new Date(conn.lastUsedAt).toLocaleDateString() : '-',
      ]);
    }

    console.log(table.toString());
  } catch (error) {
    console.error(chalk.red('✗ Failed to list connections'), error);
    process.exit(1);
  }
}
