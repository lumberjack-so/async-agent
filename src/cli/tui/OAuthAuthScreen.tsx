/**
 * OAuth Authentication Screen
 *
 * Displays auth URL and polls for completion in TUI
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { getComposioClient } from '../../services/composio/client.js';

interface OAuthAuthScreenProps {
  authUrl: string;
  connectionId: string;
  toolkitName: string;
  onComplete: (status: 'active' | 'needs_auth' | 'failed') => void;
  onCancel?: () => void;
}

type AuthState = 'polling' | 'success' | 'failed' | 'timeout';

export const OAuthAuthScreen: React.FC<OAuthAuthScreenProps> = ({
  authUrl,
  connectionId,
  toolkitName,
  onComplete,
}) => {
  const [state, setState] = useState<AuthState>('polling');
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 60; // 5 minutes with 5-second intervals

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const pollStatus = async () => {
      if (!isMounted || state !== 'polling') return;

      try {
        const client = getComposioClient();
        const status = await client.checkConnectionStatus(connectionId);

        if (!isMounted) return;

        if (status === 'active') {
          setState('success');
          setTimeout(() => {
            if (isMounted) {
              onComplete('active');
            }
          }, 1500); // Show success message briefly
        } else if (status === 'failed') {
          setState('failed');
          setTimeout(() => {
            if (isMounted) {
              onComplete('failed');
            }
          }, 2000);
        } else {
          // Still pending, continue polling
          setAttempts((prev) => {
            const newAttempts = prev + 1;
            if (newAttempts >= maxAttempts) {
              setState('timeout');
              setTimeout(() => {
                if (isMounted) {
                  onComplete('needs_auth');
                }
              }, 2000);
              return prev;
            }
            return newAttempts;
          });

          // Schedule next poll
          timeoutId = setTimeout(pollStatus, 5000);
        }
      } catch (error) {
        // Error checking status, continue polling
        if (!isMounted) return;

        setAttempts((prev) => {
          const newAttempts = prev + 1;
          if (newAttempts >= maxAttempts) {
            setState('timeout');
            setTimeout(() => {
              if (isMounted) {
                onComplete('needs_auth');
              }
            }, 2000);
            return prev;
          }
          return newAttempts;
        });

        timeoutId = setTimeout(pollStatus, 5000);
      }
    };

    // Start polling after initial 5 second delay
    timeoutId = setTimeout(pollStatus, 5000);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [connectionId, state, onComplete, maxAttempts]);

  const elapsed = attempts * 5;
  const remaining = Math.max(0, 300 - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor={
          state === 'success'
            ? 'green'
            : state === 'failed' || state === 'timeout'
            ? 'red'
            : 'cyan'
        }
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <Text bold color="cyan">
          🔑 OAuth Authentication Required
        </Text>

        <Box marginTop={1} marginBottom={1}>
          <Text color="yellow">Open this URL in your browser:</Text>
        </Box>

        <Box
          borderStyle="single"
          borderColor="blue"
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <Text color="blue">{authUrl}</Text>
        </Box>

        {state === 'polling' && (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Text color="cyan">
                <Spinner type="dots" />
              </Text>
              <Text> Waiting for authentication...</Text>
            </Box>
            <Box>
              <Text color="gray">
                Time remaining: {minutes}m {seconds}s ({attempts}/{maxAttempts} checks)
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press Ctrl+C to cancel</Text>
            </Box>
          </Box>
        )}

        {state === 'success' && (
          <Box marginTop={1}>
            <Text color="green">✓ Authentication successful!</Text>
          </Box>
        )}

        {state === 'failed' && (
          <Box marginTop={1} flexDirection="column">
            <Text color="red">✗ Authentication failed</Text>
            <Text color="gray">The authentication was rejected or cancelled</Text>
          </Box>
        )}

        {state === 'timeout' && (
          <Box marginTop={1} flexDirection="column">
            <Text color="red">✗ Authentication timed out</Text>
            <Text color="gray">
              No response after 5 minutes. Connection will be saved as 'needs_auth'
            </Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">Connecting to: {toolkitName}</Text>
      </Box>
    </Box>
  );
};
