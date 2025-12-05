/**
 * Message History Component
 * Displays chat message history with color-coded messages
 */

import React from 'react';
import { Box, Text } from 'ink';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    requestId?: string;
    cost?: number;
    duration?: number;
    workflow?: string;
  };
}

interface MessageHistoryProps {
  messages: Message[];
  maxMessages?: number;
}

export const MessageHistory: React.FC<MessageHistoryProps> = ({
  messages,
  maxMessages = 50,
}) => {
  // Show last N messages
  const displayMessages = messages.slice(-maxMessages);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderMessage = (message: Message) => {
    switch (message.type) {
      case 'user':
        return (
          <Box key={message.id} marginY={0} flexDirection="column">
            <Box>
              <Text color="green" bold>
                {' '}
              </Text>
              <Text color="white">{message.content}</Text>
            </Box>
          </Box>
        );

      case 'assistant':
        return (
          <Box key={message.id} marginY={0} flexDirection="column">
            <Box>
              <Text color="cyan">{'  '}</Text>
              <Text>{message.content}</Text>
            </Box>
            {message.metadata && (
              <Box marginLeft={2}>
                <Text dimColor>
                  {message.metadata.requestId && `ID: ${message.metadata.requestId.substring(0, 12)}... `}
                  {message.metadata.duration && `${message.metadata.duration}ms `}
                  {message.metadata.cost && `$${message.metadata.cost.toFixed(4)}`}
                  {message.metadata.workflow && ` • ${message.metadata.workflow}`}
                </Text>
              </Box>
            )}
          </Box>
        );

      case 'system':
        return (
          <Box key={message.id} marginY={0}>
            <Text color="gray" dimColor>
              ℹ {message.content}
            </Text>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {displayMessages.length === 0 ? (
        <Box>
          <Text dimColor>No messages yet. Type a prompt to get started!</Text>
        </Box>
      ) : (
        displayMessages.map(renderMessage)
      )}
    </Box>
  );
};
