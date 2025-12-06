/**
 * Message History Component
 * Displays chat message history with color-coded messages
 */

import React from 'react';
import { Box, Text } from 'ink';
import { MessageCard } from './MessageCard.js';

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

  return (
    <Box flexDirection="column" flexGrow={1}>
      {displayMessages.length === 0 ? (
        <Box paddingX={1}>
          <Text dimColor>No messages yet. Type a prompt to get started!</Text>
        </Box>
      ) : (
        displayMessages.map((message, index) => (
          <MessageCard key={message.id} message={message} index={index} />
        ))
      )}
    </Box>
  );
};
