/**
 * Connection Manager TUI
 *
 * Interactive terminal UI for managing Composio connections
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import type { Connection } from '@prisma/client';
import type { ComposioToolkit } from '../../../types/composio.js';
import { getComposioClient, isComposioAvailable } from '../../../services/composio/client.js';
import { getComposioDatabase } from '../../../services/composio/database.js';
import { getToolkitSyncService } from '../../../services/composio/toolkit-sync.js';
import { formatAuthStatus, getStatusColor } from '../../../services/composio/utils.js';
import { getPrismaClient } from '../../../db/client.js';
import { OAuthAuthScreen } from '../../tui/OAuthAuthScreen.js';

type Screen = 'list' | 'add' | 'browse' | 'options' | 'loading' | 'error' | 'auth';

interface Props {
  onExit?: () => void;
}

// ============== Main Component ==============

const ConnectionManager: React.FC<Props> = ({ onExit }) => {
  const [screen, setScreen] = useState<Screen>('loading');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [toolkits, setToolkits] = useState<ComposioToolkit[]>([]);
  const [filteredToolkits, setFilteredToolkits] = useState<ComposioToolkit[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auth flow state
  const [authUrl, setAuthUrl] = useState<string>('');
  const [authConnectionId, setAuthConnectionId] = useState<string>('');
  const [authToolkit, setAuthToolkit] = useState<ComposioToolkit | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Filter toolkits when search query changes
  useEffect(() => {
    if (searchQuery) {
      const filtered = toolkits.filter(
        (toolkit) =>
          toolkit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          toolkit.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          toolkit.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          toolkit.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredToolkits(filtered);
    } else {
      setFilteredToolkits(toolkits);
    }
  }, [searchQuery, toolkits]);

  async function loadData() {
    try {
      setScreen('loading');

      if (!isComposioAvailable()) {
        setError('Connections are not enabled. Set COMPOSIO_API_KEY environment variable.');
        setScreen('error');
        return;
      }

      const db = getComposioDatabase();
      const syncService = getToolkitSyncService();

      // Load connections
      const conns = await db.getComposioConnections();
      setConnections(conns);

      // Load toolkits from cache
      const cachedToolkits = await syncService.getAllToolkits();
      setToolkits(cachedToolkits);
      setFilteredToolkits(cachedToolkits);

      setScreen('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setScreen('error');
    }
  }

  // Render error screen
  if (screen === 'error') {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
        <Text color="gray">Press Ctrl+C to exit</Text>
      </Box>
    );
  }

  // Render loading screen
  if (screen === 'loading') {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" /> Loading connections...
        </Text>
      </Box>
    );
  }

  // Render list screen
  if (screen === 'list') {
    return (
      <ConnectionsList
        connections={connections}
        onSelect={(conn) => {
          setSelectedConnection(conn);
          setScreen('options');
        }}
        onAdd={() => setScreen('browse')}
        onExit={onExit}
      />
    );
  }

  // Render browse toolkits screen
  if (screen === 'browse') {
    return (
      <BrowseToolkits
        toolkits={filteredToolkits}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelect={async (toolkit) => {
          setScreen('loading');

          try {
            const client = getComposioClient();
            const db = getComposioDatabase();

            // Initiate connection
            const authFlow = await client.initiateConnection({
              toolkitName: toolkit.name,
            });

            // DEBUG: Log what Composio returns
            console.log('\n🔍 DEBUG: authFlow response:', JSON.stringify(authFlow, null, 2));

            if (!authFlow.connectionId) {
              setError('Failed to initiate connection');
              setScreen('error');
              return;
            }

            // If OAuth, show auth screen
            if (authFlow.type === 'oauth' && authFlow.authUrl) {
              setAuthUrl(authFlow.authUrl);
              setAuthConnectionId(authFlow.connectionId);
              setAuthToolkit(toolkit);
              setSearchQuery('');
              setScreen('auth');
            } else {
              // Non-OAuth, save immediately as active
              await db.createComposioConnection({
                name: toolkit.displayName,
                composioAccountId: authFlow.connectionId,
                composioToolkit: toolkit.name,
                tools: toolkit.tools || [], // Use toolkit's tools array
                authStatus: 'active',
              });

              setSearchQuery('');
              await loadData();
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add connection');
            setScreen('error');
          }
        }}
        onBack={() => {
          setSearchQuery('');
          setScreen('list');
        }}
      />
    );
  }

  // Render options screen
  if (screen === 'options' && selectedConnection) {
    return (
      <ConnectionOptions
        connection={selectedConnection}
        onReauthenticate={async () => {
          setScreen('loading');
          await reauthenticateConnection(selectedConnection);
          await loadData();
        }}
        onToggleActive={async () => {
          setScreen('loading');
          await toggleConnectionActive(selectedConnection);
          await loadData();
        }}
        onDelete={async () => {
          setScreen('loading');
          await deleteConnection(selectedConnection);
          await loadData();
        }}
        onBack={() => setScreen('list')}
      />
    );
  }

  // Render auth screen
  if (screen === 'auth' && authUrl && authConnectionId && authToolkit) {
    return (
      <OAuthAuthScreen
        authUrl={authUrl}
        connectionId={authConnectionId}
        toolkitName={authToolkit.displayName}
        onComplete={async (status) => {
          console.log('\n🔍 onComplete called with status:', status);

          try {
            setScreen('loading');

            // Save connection with actual auth status
            console.log('🔍 Saving connection to database...');
            const db = getComposioDatabase();
            await db.createComposioConnection({
              name: authToolkit.displayName,
              composioAccountId: authConnectionId,
              composioToolkit: authToolkit.name,
              tools: authToolkit.tools || [], // Use toolkit's tools array
              authStatus: status,
            });
            console.log('🔍 Connection saved successfully');

            // Reset auth state
            setAuthUrl('');
            setAuthConnectionId('');
            setAuthToolkit(null);

            // Reload data and return to list
            console.log('🔍 Reloading data...');
            await loadData();
            console.log('🔍 Data reloaded, returning to list');
            setScreen('list'); // FIX: Must set screen to show the list!
          } catch (error) {
            console.error('🔍 ERROR in onComplete:', error);
            setError(error instanceof Error ? error.message : 'Failed to save connection');
            setScreen('error');
          }
        }}
      />
    );
  }

  return null;
};

// ============== Connections List Component ==============

interface ConnectionsListProps {
  connections: Connection[];
  onSelect: (connection: Connection) => void;
  onAdd: () => void;
  onExit?: () => void;
}

const ConnectionsList: React.FC<ConnectionsListProps> = ({
  connections,
  onSelect,
  onAdd,
  onExit,
}) => {
  const items = [
    { label: '+ Add new connection', value: 'add' },
    ...connections.map((conn) => {
      const statusColor = getStatusColor(conn.authStatus);
      const statusText = formatAuthStatus(conn.authStatus);
      return {
        label: `${statusText}  ${conn.name}`,
        value: conn.id,
      };
    }),
  ];

  if (items.length === 1) {
    // Only "add" option
    items.push({ label: '← Back', value: 'back' });
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        🔌 Connections
      </Text>
      <Text color="gray">
        {connections.length === 0
          ? 'No connections yet. Add your first connection!'
          : `${connections.length} connection${connections.length !== 1 ? 's' : ''}`}
      </Text>
      <Text color="gray">↑↓ navigate • Enter select • q quit</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={(item) => {
            if (item.value === 'add') {
              onAdd();
            } else if (item.value === 'back') {
              onExit?.();
            } else {
              const conn = connections.find((c) => c.id === item.value);
              if (conn) {
                onSelect(conn);
              }
            }
          }}
        />
      </Box>
    </Box>
  );
};

// ============== Browse Toolkits Component ==============

interface BrowseToolkitsProps {
  toolkits: ComposioToolkit[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (toolkit: ComposioToolkit) => Promise<void>;
  onBack: () => void;
}

const BrowseToolkits: React.FC<BrowseToolkitsProps> = ({
  toolkits,
  searchQuery,
  onSearchChange,
  onSelect,
  onBack,
}) => {
  const [isSearching, setIsSearching] = useState(true);

  // Group by category
  const categories: Record<string, ComposioToolkit[]> = {};
  toolkits.forEach((toolkit) => {
    const category = toolkit.category || 'Other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(toolkit);
  });

  // Create flat list with category headers
  const items: Array<{ label: string; value: string | ComposioToolkit }> = [];

  Object.entries(categories)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, tkts]) => {
      // Category header
      items.push({
        label: `─── ${category} (${tkts.length}) ${'─'.repeat(40)}`,
        value: `category-header:${category}`,
      });

      // Services in category
      tkts.forEach((toolkit) => {
        items.push({
          label: `  ${toolkit.displayName} - ${toolkit.description.slice(0, 50)}${toolkit.description.length > 50 ? '...' : ''}`,
          value: `toolkit:${toolkit.name}`,
        });
      });
    });

  if (items.length === 0) {
    items.push({
      label: 'No connections found. Try a different search.',
      value: 'none',
    });
  }

  items.push({ label: '← Back', value: 'back' });

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        📦 Available Connections
      </Text>
      <Text color="gray">{toolkits.length} connections available</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text>Search: </Text>
        {isSearching ? (
          <TextInput
            value={searchQuery}
            onChange={onSearchChange}
            onSubmit={() => setIsSearching(false)}
          />
        ) : (
          <Text>{searchQuery || '(none)'}</Text>
        )}
        <Text color="gray"> (Tab to browse, Esc to cancel)</Text>
      </Box>

      {!isSearching && (
        <Box flexDirection="column">
          <SelectInput
            items={items.slice(0, 20)} // Show first 20 items
            onSelect={(item) => {
              if (item.value === 'back') {
                onBack();
              } else if (typeof item.value === 'string' && item.value.startsWith('toolkit:')) {
                const toolkitName = item.value.replace('toolkit:', '');
                const toolkit = toolkits.find((t) => t.name === toolkitName);
                if (toolkit) {
                  onSelect(toolkit);
                }
              }
            }}
          />
          {items.length > 20 && (
            <Text color="yellow">
              Showing first 20 of {items.length} results. Use search to narrow down.
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

// ============== Connection Options Component ==============

interface ConnectionOptionsProps {
  connection: Connection;
  onReauthenticate: () => Promise<void>;
  onToggleActive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onBack: () => void;
}

const ConnectionOptions: React.FC<ConnectionOptionsProps> = ({
  connection,
  onReauthenticate,
  onToggleActive,
  onDelete,
  onBack,
}) => {
  const items = [
    { label: '🔄 Reauthenticate', value: 'reauth' },
    {
      label: connection.isActive ? '⏸  Disable' : '▶️  Enable',
      value: 'toggle',
    },
    { label: '🗑  Delete', value: 'delete' },
    { label: '← Back', value: 'back' },
  ];

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {connection.name}
      </Text>
      <Text color="gray">Status: {formatAuthStatus(connection.authStatus)}</Text>
      <Text color="gray">Tools: {connection.tools.length}</Text>
      <Text color="gray">Active: {connection.isActive ? 'Yes' : 'No'}</Text>

      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={async (item) => {
            switch (item.value) {
              case 'reauth':
                await onReauthenticate();
                break;
              case 'toggle':
                await onToggleActive();
                break;
              case 'delete':
                await onDelete();
                break;
              case 'back':
                onBack();
                break;
            }
          }}
        />
      </Box>
    </Box>
  );
};

// ============== Helper Functions ==============

// This function is now just a stub - actual implementation moved to component level
// It's referenced in the onSelect callback but not used anymore
async function addConnection(toolkit: ComposioToolkit) {
  // Not used - kept for backwards compatibility
}

async function reauthenticateConnection(connection: Connection) {
  if (!connection.composioToolkit) return;

  const client = getComposioClient();
  const db = getComposioDatabase();

  console.log(chalk.cyan(`\nReauthenticating: ${connection.name}`));

  const authFlow = await client.initiateConnection({
    toolkitName: connection.composioToolkit,
  });

  if (!authFlow.connectionId) {
    console.error(chalk.red('✗ Failed to initiate reauthentication'));
    return;
  }

  let finalStatus: 'active' | 'needs_auth' | 'expired' | 'failed' = 'needs_auth';

  if (authFlow.type === 'oauth' && authFlow.authUrl) {
    console.log(chalk.yellow('\n📎 Open this URL to authenticate:'));
    console.log(chalk.blue(authFlow.authUrl));
    console.log(chalk.gray('\nWaiting for authentication... (max 5 minutes)\n'));

    // Poll for completion
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;

      try {
        const status = await client.checkConnectionStatus(authFlow.connectionId);

        if (status === 'active') {
          finalStatus = 'active';
          console.log(chalk.green('\n✓ Reauthentication successful!'));
          break;
        } else if (status === 'failed') {
          finalStatus = 'failed';
          console.error(chalk.red('\n✗ Reauthentication failed'));
          break;
        }

        process.stdout.write(chalk.gray('.'));
      } catch (error) {
        process.stdout.write(chalk.gray('.'));
      }
    }

    if (finalStatus === 'needs_auth') {
      console.error(chalk.red('\n✗ Reauthentication timed out'));
    }
  } else {
    finalStatus = 'active';
  }

  await db.updateConnectionAuthStatus(connection.id, finalStatus);
  console.log(chalk.gray(`Status updated to: ${finalStatus}\n`));
}

async function toggleConnectionActive(connection: Connection) {
  const prisma = getPrismaClient();

  await prisma.connection.update({
    where: { id: connection.id },
    data: { isActive: !connection.isActive },
  });

  console.log(
    chalk.green(`✓ Connection ${connection.isActive ? 'disabled' : 'enabled'}\n`)
  );
}

async function deleteConnection(connection: Connection) {
  const client = getComposioClient();
  const prisma = getPrismaClient();

  console.log(chalk.yellow(`\nDeleting connection: ${connection.name}`));

  // Delete from Composio
  if (connection.composioAccountId) {
    try {
      await client.deleteConnectedAccount(connection.composioAccountId);
    } catch (error) {
      console.warn(chalk.yellow('⚠ Failed to delete from Composio (might already be deleted)'));
    }
  }

  // Delete from local database
  await prisma.connection.delete({
    where: { id: connection.id },
  });

  console.log(chalk.green('✓ Connection deleted\n'));
}

// ============== Export ==============

export async function manageConnectionsCommand() {
  const { waitUntilExit } = render(<ConnectionManager />);
  await waitUntilExit();
}
