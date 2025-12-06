/**
 * Status Bar Component - Contextual Help & Shortcuts
 * Two states: streaming (with border) and idle (contextual shortcuts)
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from './theme.js';

interface StatusBarProps {
  isStreaming: boolean;
  mode: string;
  canInterrupt?: boolean;
}

interface Shortcut {
  key: string;
  action: string;
}

/**
 * Get contextual shortcuts based on current mode
 */
const getContextualShortcuts = (mode: string): Shortcut[] => {
  const base: Shortcut[] = [
    { key: '↵', action: 'send' },
    { key: 'Esc', action: 'exit' },
  ];

  if (mode === 'chat') {
    return [
      { key: 'Tab', action: 'switch mode' },
      ...base,
      { key: '/help', action: 'commands' },
    ];
  }

  return base;
};

/**
 * StatusBar Component
 *
 * Streaming state: Shows spinner with "Processing..." and optional interrupt hint
 * Idle state: Shows contextual keyboard shortcuts based on mode
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  isStreaming,
  mode,
  canInterrupt = false,
}) => {
  if (isStreaming) {
    return (
      <Box
        borderStyle="round"
        borderColor={colors.accent}
        paddingX={2}
        paddingY={0}
      >
        <Text color={colors.accent}>
          <Spinner type="dots" />
        </Text>
        <Text color={colors.accent} bold>
          {' '}
          Processing...
        </Text>
        <Box flexGrow={1} />
        {canInterrupt && (
          <Text dimColor>
            Press <Text color={colors.primary} bold>Esc</Text> to interrupt
          </Text>
        )}
      </Box>
    );
  }

  // Idle state: contextual shortcuts based on mode
  const shortcuts = getContextualShortcuts(mode);

  return (
    <Box paddingX={2} paddingY={0}>
      {shortcuts.map((shortcut, idx) => (
        <Box key={idx} marginRight={3}>
          <Text color={colors.primary} bold>
            {shortcut.key}
          </Text>
          <Text dimColor> {shortcut.action}</Text>
        </Box>
      ))}
    </Box>
  );
};
