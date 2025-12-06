/**
 * Chat Input Component with Autocomplete Hints
 * Enhanced with dynamic border colors, slash command hints, and character counter
 */

import React from 'react';
import { Box, Text, useFocus } from 'ink';
import TextInput from 'ink-text-input';
import { colors } from './theme.js';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

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
}) => {
  // Track focus state using Ink's useFocus hook
  const { isFocused } = useFocus({ autoFocus: !disabled });

  // Detect slash commands for autocomplete hints
  const isCommand = value.startsWith('/');
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

  return (
    <Box flexDirection="column">
      {/* Command autocomplete hint */}
      {commandHint && (
        <Box marginBottom={0}>
          <Text dimColor>💡 {commandHint}</Text>
        </Box>
      )}

      {/* Input box with dynamic border */}
      <Box
        borderStyle="round"
        borderColor={getBorderColor()}
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
              onSubmit(value);
              onChange('');
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
