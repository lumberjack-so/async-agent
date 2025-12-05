/**
 * Chat Input Component with Keyword Highlighting
 * Highlights "async" keyword in yellow
 */

import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Type your message...',
}) => {
  // Check if input ends with "async"
  const endsWithAsync = value.trim().toLowerCase().endsWith('async');
  const hasAsync = value.toLowerCase().includes(' async');

  // Render input with highlighting
  const renderHighlightedInput = () => {
    if (!hasAsync) {
      return <Text>{value || placeholder}</Text>;
    }

    // Split and highlight "async"
    const parts = value.split(/(\basync\b)/gi);
    return (
      <Text>
        {parts.map((part, i) =>
          part.toLowerCase() === 'async' ? (
            <Text key={i} color="yellow" bold>
              {part}
            </Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  return (
    <Box
      borderStyle="round"
      borderColor={endsWithAsync ? 'yellow' : 'gray'}
      paddingX={1}
      flexDirection="column"
    >
      <Box>
        <Text color="cyan" bold>
          {' '}
        </Text>
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

      {/* Async mode indicator */}
      {endsWithAsync && !disabled && (
        <Box marginTop={0}>
          <Text color="yellow" dimColor>
            🟡 Async mode enabled
          </Text>
        </Box>
      )}
    </Box>
  );
};
