/**
 * Token Usage Display Component
 * Shows real-time token consumption and cost
 */

import React from 'react';
import { Box, Text } from 'ink';

interface TokenUsageDisplayProps {
  tokenCount?: number;
  maxTokens?: number;
  cost?: number;
  model?: string;
}

export const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({
  tokenCount = 0,
  maxTokens = 200000,
  cost = 0,
  model = 'claude-haiku-4-5',
}) => {
  const percentage = Math.min((tokenCount / maxTokens) * 100, 100);
  const barWidth = 20;
  const filled = Math.round((percentage / 100) * barWidth);
  const empty = barWidth - filled;

  // Color based on usage
  const getColor = () => {
    if (percentage >= 90) return 'red';
    if (percentage >= 70) return 'yellow';
    return 'green';
  };

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">◆</Text>
        <Box marginLeft={1}>
          <Text>{model}</Text>
        </Box>
      </Box>

      <Box marginTop={0}>
        <Text color={getColor()}>{bar}</Text>
        <Box marginLeft={1}>
          <Text dimColor>
            {tokenCount.toLocaleString()} / {maxTokens.toLocaleString()} ({percentage.toFixed(1)}%)
          </Text>
        </Box>
      </Box>

      {cost > 0 && (
        <Box marginTop={0}>
          <Text color="yellow">$</Text>
          <Box marginLeft={1}>
            <Text>{cost.toFixed(4)}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
