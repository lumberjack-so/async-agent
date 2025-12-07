/**
 * Connections Command
 *
 * Main command structure for managing Composio connections
 */

import { Command } from 'commander';
import { listConnectionsCommand } from './list.js';
import { addConnectionCommand } from './add.js';
import { deleteConnectionCommand } from './delete.js';
import { manageConnectionsCommand } from './manage.js';

export function createConnectionsCommand(): Command {
  const connectionsCmd = new Command('connections')
    .alias('conn')
    .description('Manage connections')
    .action(async () => {
      // Default action: launch TUI
      await manageConnectionsCommand();
    });

  // alfred connections list
  connectionsCmd
    .command('list')
    .description('List all connections')
    .option('--json', 'Output as JSON')
    .action(listConnectionsCommand);

  // alfred connections add <service>
  connectionsCmd
    .command('add <toolkit>')
    .description('Add a new connection')
    .action(addConnectionCommand);

  // alfred connections delete <id>
  connectionsCmd
    .command('delete <connectionId>')
    .description('Delete a connection')
    .option('-y, --yes', 'Skip confirmation')
    .action(deleteConnectionCommand);

  return connectionsCmd;
}
