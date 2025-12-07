/**
 * Connections Menu Component
 * Interactive menu for managing service connections in TUI mode
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import type { Connection } from '@prisma/client';
import type { ComposioToolkit } from '../../types/composio.js';
import { getComposioClient, isComposioAvailable } from '../../services/composio/client.js';
import { getComposioDatabase } from '../../services/composio/database.js';
import { getToolkitSyncService } from '../../services/composio/toolkit-sync.js';
import { formatAuthStatus, getStatusColor } from '../../services/composio/utils.js';
import { getPrismaClient } from '../../db/client.js';
import { colors } from './theme.js';
import { OAuthAuthScreen } from './OAuthAuthScreen.js';

interface ConnectionsMenuProps {
  onBack: () => void;
}

type MenuState = 'main' | 'list' | 'browse' | 'options' | 'loading' | 'auth';

export const ConnectionsMenu: React.FC<ConnectionsMenuProps> = ({ onBack }) => {
  const [state, setState] = useState<MenuState>('loading');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [toolkits, setToolkits] = useState<ComposioToolkit[]>([]);
  const [filteredToolkits, setFilteredToolkits] = useState<ComposioToolkit[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
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
      setState('loading');

      if (!isComposioAvailable()) {
        setError('Connections are not enabled. Set COMPOSIO_API_KEY environment variable.');
        setState('main');
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

      setState('main');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setState('main');
    }
  }

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

    let finalStatus: 'active' | 'needs_auth' | 'expired' | 'failed' = 'needs_auth';

    if (authFlow.type === 'oauth') {
      if (!authFlow.authUrl) {
        console.error(chalk.red('✗ No authentication URL provided by Composio'));
        finalStatus = 'failed';
      } else {
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
              finalStatus = 'active';
              console.log(chalk.green('\n✓ Authentication successful!'));
            } else if (status === 'failed') {
              finalStatus = 'failed';
              console.error(chalk.red('\n✗ Authentication failed'));
              break;
            }

            process.stdout.write(chalk.gray('.'));
          } catch (error) {
            process.stdout.write(chalk.gray('.'));
          }
        }

        if (!authComplete && finalStatus !== 'failed') {
          console.error(chalk.red('\n✗ Authentication timed out'));
          finalStatus = 'needs_auth';
        }
      }
    } else {
      // Non-OAuth (API key, etc.) - assume active immediately
      finalStatus = 'active';
    }

    // Save to database with actual status and toolkit's tools
    await db.createComposioConnection({
      name: toolkit.displayName,
      composioAccountId: authFlow.connectionId,
      composioToolkit: toolkit.name,
      tools: toolkit.tools || [], // Use toolkit's tools array
      authStatus: finalStatus,
    });

    if (finalStatus === 'active') {
      console.log(chalk.green(`✓ Connection created: ${toolkit.displayName}\n`));
    } else {
      console.log(chalk.yellow(`⚠ Connection created with status: ${finalStatus}\n`));
      console.log(chalk.gray('You may need to reauthenticate this connection later.\n'));
    }
  }

  async function reauthenticateConnection(connection: Connection) {
    if (!connection.composioToolkit) return;

    const client = getComposioClient();
    const db = getComposioDatabase();
    const toolkitName = connection.composioToolkit;

    console.log(chalk.cyan(`\nReauthenticating: ${connection.name}`));

    const authFlow = await client.initiateConnection({
      toolkitName,
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

  // Render loading screen
  if (state === 'loading') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor={colors.primary}
          paddingX={2}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color={colors.primary}>
            🔌 Connections
          </Text>
        </Box>
        <Box>
          <Text color={colors.primary}>
            <Spinner type="dots" /> Loading connections...
          </Text>
        </Box>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor="red"
          paddingX={2}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color="red">
            🔌 Connections
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color="red">✗ {error}</Text>
          <Box marginTop={1}>
            <SelectInput
              items={[{ label: '← Back to chat', value: 'back' }]}
              onSelect={() => onBack()}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  // Main menu - list connections
  if (state === 'main') {
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
      { label: '← Back to chat', value: 'back' },
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor={colors.primary}
          paddingX={2}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color={colors.primary}>
            🔌 Connections
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color={colors.text.secondary}>
            {connections.length === 0
              ? 'No connections yet. Add your first connection!'
              : `${connections.length} connection${connections.length !== 1 ? 's' : ''} configured`}
          </Text>
        </Box>

        <SelectInput
          items={items}
          onSelect={(item) => {
            if (item.value === 'add') {
              setState('browse');
              setIsSearching(true);
            } else if (item.value === 'back') {
              onBack();
            } else {
              const conn = connections.find((c) => c.id === item.value);
              if (conn) {
                setSelectedConnection(conn);
                setState('options');
              }
            }
          }}
        />
      </Box>
    );
  }

  // Browse services screen
  if (state === 'browse') {
    // Group by category
    const categories: Record<string, ComposioToolkit[]> = {};
    filteredToolkits.forEach((toolkit) => {
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
        tkts.slice(0, 5).forEach((toolkit) => {
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
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor={colors.primary}
          paddingX={2}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color={colors.primary}>
            📦 Available Services
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color={colors.text.secondary}>{toolkits.length} services available</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>Search: </Text>
          {isSearching ? (
            <TextInput
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={() => setIsSearching(false)}
            />
          ) : (
            <>
              <Text>{searchQuery || '(none)'}</Text>
              <Text color={colors.text.secondary}> (press Enter to search again)</Text>
            </>
          )}
        </Box>

        {!isSearching && (
          <Box flexDirection="column">
            <SelectInput
              items={items.slice(0, 25)}
              onSelect={async (item) => {
                if (item.value === 'back') {
                  setSearchQuery('');
                  setState('main');
                } else if (typeof item.value === 'object') {
                  setState('loading');

                  try {
                    const toolkit = item.value as ComposioToolkit;
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
                      setState('main');
                      return;
                    }

                    // If OAuth, show auth screen
                    if (authFlow.type === 'oauth' && authFlow.authUrl) {
                      setAuthUrl(authFlow.authUrl);
                      setAuthConnectionId(authFlow.connectionId);
                      setAuthToolkit(toolkit);
                      setSearchQuery('');
                      setState('auth');
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
                    setState('main');
                  }
                }
              }}
            />
            {items.length > 25 && (
              <Text color="yellow">
                Showing first 25 of {items.length} results. Use search to narrow down.
              </Text>
            )}
          </Box>
        )}

        {isSearching && (
          <Box marginTop={1}>
            <Text dimColor>Press Enter to browse, Esc to cancel</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Connection options screen
  if (state === 'options' && selectedConnection) {
    const items = [
      { label: '🔄 Reauthenticate', value: 'reauth' },
      {
        label: selectedConnection.isActive ? '⏸  Disable' : '▶️  Enable',
        value: 'toggle',
      },
      { label: '🗑  Delete', value: 'delete' },
      { label: '← Back', value: 'back' },
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor={colors.primary}
          paddingX={2}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color={colors.primary}>
            {selectedConnection.name}
          </Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text color={colors.text.secondary}>Status: {formatAuthStatus(selectedConnection.authStatus)}</Text>
          <Text color={colors.text.secondary}>Tools: {selectedConnection.tools.length}</Text>
          <Text color={colors.text.secondary}>Active: {selectedConnection.isActive ? 'Yes' : 'No'}</Text>
        </Box>

        <SelectInput
          items={items}
          onSelect={async (item) => {
            switch (item.value) {
              case 'reauth':
                setState('loading');
                await reauthenticateConnection(selectedConnection);
                await loadData();
                break;
              case 'toggle':
                setState('loading');
                await toggleConnectionActive(selectedConnection);
                await loadData();
                break;
              case 'delete':
                setState('loading');
                await deleteConnection(selectedConnection);
                await loadData();
                break;
              case 'back':
                setSelectedConnection(null);
                setState('main');
                break;
            }
          }}
        />
      </Box>
    );
  }

  // Render auth screen
  if (state === 'auth' && authUrl && authConnectionId && authToolkit) {
    return (
      <OAuthAuthScreen
        authUrl={authUrl}
        connectionId={authConnectionId}
        toolkitName={authToolkit.displayName}
        onComplete={async (status) => {
          console.log('\n🔍 onComplete called with status:', status);

          try {
            setState('loading');

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

            // Reload data and return to main
            console.log('🔍 Reloading data...');
            await loadData();
            console.log('🔍 Data reloaded, returning to main');
            setState('main');
          } catch (error) {
            console.error('🔍 ERROR in onComplete:', error);
            setError(error instanceof Error ? error.message : 'Failed to save connection');
            setState('main');
          }
        }}
      />
    );
  }

  return null;
};
