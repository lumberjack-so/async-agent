/**
 * Chat Input Component with Autocomplete Hints and Command Menu
 * Enhanced with dynamic border colors, slash command hints, selectable command menu
 */

import React, { useState } from 'react';
import { Box, Text, useFocus, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { colors } from './theme.js';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onCommandSelect?: (command: string) => void;
}

interface CommandItem {
  label: string;
  value: string;
  description: string;
}

const AVAILABLE_COMMANDS: CommandItem[] = [
  { label: '/skills', value: '/skills', description: 'Manage and browse your AI workflows' },
  { label: '/history', value: '/history', description: 'View past execution history' },
  { label: '/health', value: '/health', description: 'Check system status' },
  { label: '/clear', value: '/clear', description: 'Clear chat history' },
  { label: '/help', value: '/help', description: 'Show all available commands' },
];

/**
 * Get autocomplete hint for slash commands
 */
const getCommandHint = (input: string): string | null => {
  const cmd = input.toLowerCase();
  const hints: Record<string, string> = {
    '/sk': 'Press Tab to autocomplete "/skills"',
    '/he': 'Press Tab to autocomplete "/health"',
    '/hi': 'Press Tab to autocomplete "/history"',
    '/cl': 'Press Tab to autocomplete "/clear"',
    '/help': 'Shows all available commands',
    '/skills': 'Manage and browse your AI workflows',
    '/history': 'View past execution history',
    '/health': 'Check system status',
    '/clear': 'Clear chat history',
  };

  for (const [prefix, hint] of Object.entries(hints)) {
    if (cmd.startsWith(prefix)) return hint;
  }
  return null;
};

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Type your message...',
  onCommandSelect,
}) => {
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  // Track focus state using Ink's useFocus hook
  const { isFocused } = useFocus({ autoFocus: !disabled });

  // Show command menu when user types just "/"
  const shouldShowMenu = value === '/' && !disabled;

  // Detect slash commands for autocomplete hints
  const isCommand = value.startsWith('/') && value.length > 1;
  const commandHint = isCommand ? getCommandHint(value) : null;

  // Character count logic
  const showCharCount = value.length > 100;
  const isLongInput = value.length > 200;

  // Dynamic border color
  const getBorderColor = () => {
    if (disabled) return colors.text.tertiary; // dark gray when disabled
    if (isFocused) return colors.primary; // cyan when focused
    return colors.status.pending; // gray when not focused
  };

  // Handle command selection from menu
  const handleCommandSelect = (item: { label: string; value: string }) => {
    onChange('');
    setShowCommandMenu(false);
    if (onCommandSelect) {
      onCommandSelect(item.value);
    } else {
      onSubmit(item.value);
    }
  };

  // Handle Escape key to close menu
  useInput((input, key) => {
    if (key.escape && shouldShowMenu) {
      onChange('');
      setShowCommandMenu(false);
    }
  });

  return (
    <Box flexDirection="column">
      {/* Command Menu - shown when typing "/" */}
      {shouldShowMenu && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={colors.primary}
          paddingX={1}
          marginBottom={1}
        >
          <Box marginBottom={0}>
            <Text bold color={colors.primary}>Available Commands</Text>
            <Text dimColor> (↑↓ to navigate, Enter to select, Esc to cancel)</Text>
          </Box>
          <SelectInput
            items={AVAILABLE_COMMANDS}
            onSelect={handleCommandSelect}
            itemComponent={({ isSelected, label }) => (
              <Box>
                <Text color={isSelected ? colors.primary : colors.text.primary}>
                  {isSelected ? '▸ ' : '  '}{label}
                </Text>
              </Box>
            )}
          />
        </Box>
      )}

      {/* Command autocomplete hint */}
      {commandHint && !shouldShowMenu && (
        <Box marginBottom={0}>
          <Text dimColor>💡 {commandHint}</Text>
        </Box>
      )}

      {/* Input box */}
      <Box
        paddingX={1}
      >
        <Text color={disabled ? colors.status.pending : colors.primary}>▸ </Text>
        {disabled ? (
          <Text dimColor>{value || 'Processing...'}</Text>
        ) : (
          <TextInput
            value={value}
            onChange={onChange}
            onSubmit={() => {
              if (!shouldShowMenu) {
                onSubmit(value);
                onChange('');
              }
            }}
            placeholder={placeholder}
            showCursor={!disabled}
          />
        )}
      </Box>

      {/* Character count for long inputs */}
      {showCharCount && (
        <Box justifyContent="flex-end" marginTop={0}>
          <Text dimColor color={isLongInput ? colors.warning : colors.text.secondary}>
            {value.length} characters
            {isLongInput && ' (consider breaking into multiple prompts)'}
          </Text>
        </Box>
      )}
    </Box>
  );
};
