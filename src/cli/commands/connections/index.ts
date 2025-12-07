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
    .description('Manage Composio connections')
    .action(async () => {
      // Default action: launch TUI
      await manageConnectionsCommand();
    });

  // alfred connections list
  connectionsCmd
    .command('list')
    .description('List all Composio connections')
    .option('--json', 'Output as JSON')
    .action(listConnectionsCommand);

  // alfred connections add <toolkit>
  connectionsCmd
    .command('add <toolkit>')
    .description('Add a new Composio connection')
    .action(addConnectionCommand);

  // alfred connections delete <id>
  connectionsCmd
    .command('delete <connectionId>')
    .description('Delete a Composio connection')
    .option('-y, --yes', 'Skip confirmation')
    .action(deleteConnectionCommand);

  return connectionsCmd;
}
