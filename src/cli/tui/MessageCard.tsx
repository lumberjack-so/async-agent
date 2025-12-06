/**
 * MessageCard Component
 * Rich message cards with visual separation between user/assistant/system messages
 * Based on TUI Design Proposal - MessageHistory section
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { colors, typography } from './theme.js';
import { SuccessCard } from './SuccessCard.js';
import { ErrorCard } from './ErrorCard.js';

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

interface MessageCardProps {
  message: Message;
  index: number;
}

export const MessageCard: React.FC<MessageCardProps> = ({ message, index }) => {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const isAssistant = message.type === 'assistant';

  // Color coding by type
  const borderColor = useMemo(() => {
    if (isUser) return '#00D9FF';      // Cyan - user input
    if (isSystem) return '#A0AEC0';    // Gray - system messages
    return '#B794F6';                   // Purple - assistant responses
  }, [isUser, isSystem]);

  // Icon based on message type
  const icon = useMemo(() => {
    if (isUser) return '▸ You';
    if (isSystem) return '⚙ System';
    return '🤖 Alfred';
  }, [isUser, isSystem]);

  // Border style based on message type
  const borderStyle = useMemo(() => {
    if (isUser) return 'round' as const;
    return 'single' as const;
  }, [isUser]);

  // Format timestamp as HH:MM
  const formatTime = (date: Date): string => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  // Check for special message formats (SUCCESS: or ERROR:)
  const isSuccessCard = message.content.startsWith('SUCCESS:');
  const isErrorCard = message.content.startsWith('ERROR:');

  // Parse special card data
  if (isSuccessCard) {
    try {
      const cardData = JSON.parse(message.content.substring(8)); // Remove "SUCCESS:" prefix
      return <SuccessCard {...cardData} />;
    } catch (e) {
      // Fallback to regular rendering if parsing fails
      console.error('Failed to parse SUCCESS card:', e);
    }
  }

  if (isErrorCard) {
    try {
      const cardData = JSON.parse(message.content.substring(6)); // Remove "ERROR:" prefix
      const error = new Error(cardData.message);
      return <ErrorCard error={error} suggestion={cardData.suggestion} />;
    } catch (e) {
      // Fallback to regular rendering if parsing fails
      console.error('Failed to parse ERROR card:', e);
    }
  }

  return (
    <Box
      flexDirection="column"
      marginY={0}
      marginBottom={1}
      paddingLeft={isUser ? 4 : 0}
      paddingRight={isUser ? 0 : (isAssistant ? 4 : 0)}
    >
      {/* Message header */}
      <Box>
        <Text bold color={borderColor}>
          {icon}
        </Text>
        <Box flexGrow={1} />
        <Text dimColor>{formatTime(message.timestamp)}</Text>
      </Box>

      {/* Message content card */}
      <Box
        borderStyle={borderStyle}
        borderColor={borderColor}
        paddingX={2}
        paddingY={0}
        marginTop={0}
      >
        <Text>{message.content}</Text>
      </Box>

      {/* Metadata badges (cost, duration) if available */}
      {message.metadata && (isAssistant || isUser) && (
        <Box marginTop={0}>
          {message.metadata.cost !== undefined && (
            <Text dimColor>💰 ${message.metadata.cost.toFixed(4)}</Text>
          )}
          {message.metadata.duration !== undefined && (
            <Box marginLeft={message.metadata.cost !== undefined ? 2 : 0}>
              <Text dimColor>⏱ {(message.metadata.duration / 1000).toFixed(1)}s</Text>
            </Box>
          )}
          {message.metadata.workflow && (
            <Box marginLeft={2}>
              <Text dimColor>• {message.metadata.workflow}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
