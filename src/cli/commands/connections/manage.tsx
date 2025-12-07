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

type Screen = 'list' | 'add' | 'browse' | 'options' | 'loading' | 'error';

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
        setError('Service connections are not enabled. Set COMPOSIO_API_KEY environment variable.');
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
          await addConnection(toolkit);
          setSearchQuery('');
          await loadData();
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
        value: `category:${category}`,
      });

      // Services in category
      tkts.forEach((toolkit) => {
        items.push({
          label: `  ${toolkit.displayName} - ${toolkit.description.slice(0, 50)}${toolkit.description.length > 50 ? '...' : ''}`,
          value: toolkit,
        });
      });
    });

  if (items.length === 0) {
    items.push({
      label: 'No services found. Try a different search.',
      value: 'none',
    });
  }

  items.push({ label: '← Back', value: 'back' });

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        📦 Available Services
      </Text>
      <Text color="gray">{toolkits.length} services available</Text>

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
              } else if (typeof item.value === 'object') {
                onSelect(item.value as ComposioToolkit);
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

async function addConnection(toolkit: ComposioToolkit) {
  const client = getComposioClient();
  const db = getComposioDatabase();

  console.log(chalk.cyan(`\nConnecting to ${toolkit.displayName}...`));

  // Initiate connection
  const authFlow = await client.initiateConnection({
    toolkitName: toolkit.name,
  });

  if (!authFlow.connectionId) {
    console.error(chalk.red('✗ Failed to initiate connection'));
    return;
  }

  if (authFlow.type === 'oauth' && authFlow.authUrl) {
    console.log(chalk.yellow('\n📎 Open this URL to authenticate:'));
    console.log(chalk.blue(authFlow.authUrl));
    console.log(chalk.gray('\nWaiting for authentication to complete (max 5 minutes)...'));
    console.log(chalk.gray('Press Ctrl+C to cancel\n'));

    // Poll for completion
    const maxAttempts = 60;
    let attempts = 0;
    let authComplete = false;

    while (attempts < maxAttempts && !authComplete) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;

      try {
        const status = await client.checkConnectionStatus(authFlow.connectionId);

        if (status === 'active') {
          authComplete = true;
          console.log(chalk.green('\n✓ Authentication successful!'));
        } else if (status === 'failed') {
          console.error(chalk.red('\n✗ Authentication failed'));
          return;
        }

        process.stdout.write(chalk.gray('.'));
      } catch (error) {
        process.stdout.write(chalk.gray('.'));
      }
    }

    if (!authComplete) {
      console.error(chalk.red('\n✗ Authentication timed out'));
      return;
    }
  }

  // Get tools
  const tools = await client.getToolkitTools(toolkit.name);

  // Save to database
  await db.createComposioConnection({
    name: toolkit.displayName,
    composioAccountId: authFlow.connectionId,
    composioToolkit: toolkit.name,
    tools,
  });

  console.log(chalk.green(`✓ Connection created: ${toolkit.displayName}\n`));
}

async function reauthenticateConnection(connection: Connection) {
  if (!connection.composioToolkit) return;

  const client = getComposioClient();
  const db = getComposioDatabase();

  console.log(chalk.cyan(`\nReauthenticating: ${connection.name}`));

  const authFlow = await client.initiateConnection({
    toolkitName: connection.composioToolkit,
  });

  if (authFlow.type === 'oauth' && authFlow.authUrl) {
    console.log(chalk.yellow('\n📎 Open this URL to authenticate:'));
    console.log(chalk.blue(authFlow.authUrl));
    console.log(chalk.gray('Press Enter when done...'));
  }

  await db.updateConnectionAuthStatus(connection.id, 'active');
  console.log(chalk.green('✓ Reauthentication initiated\n'));
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
