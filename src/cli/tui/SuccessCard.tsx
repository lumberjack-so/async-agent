import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import figures from 'figures';
import { colors, borders, gradients } from './theme.js';

interface SuccessCardProps {
  result: string;
  duration?: number;
  cost?: number;
  metadata?: {
    workflow?: string;
    [key: string]: any;
  };
}

/**
 * SuccessCard - Celebratory completion card with gradient header
 *
 * Displays task completion with:
 * - Double green border
 * - Gradient "Task Complete!" header
 * - Result preview (first 200 chars)
 * - Metadata badges: duration, cost, workflow name
 *
 * Design: TUI_DESIGN_PROPOSAL.md - Success Celebrations section
 */
export const SuccessCard: React.FC<SuccessCardProps> = ({
  result,
  duration,
  cost,
  metadata,
}) => {
  // Truncate result to first 200 characters
  const resultPreview = result.length > 200
    ? `${result.substring(0, 200)}...`
    : result;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors.success}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      {/* Success header with gradient */}
      <Gradient name="morning">
        <Text bold>✨ Task Complete! ✨</Text>
      </Gradient>

      {/* Result preview */}
      <Box marginTop={1} marginBottom={1}>
        <Text>{resultPreview}</Text>
      </Box>

      {/* Metadata badges */}
      <Box>
        {/* Duration badge with tick icon */}
        {duration !== undefined && (
          <Box marginRight={2}>
            <Text color={colors.success}>{figures.tick}</Text>
            <Text dimColor> {duration}s</Text>
          </Box>
        )}

        {/* Cost badge */}
        {cost !== undefined && (
          <Box marginRight={2}>
            <Text dimColor>💰 ${cost.toFixed(4)}</Text>
          </Box>
        )}

        {/* Workflow name badge */}
        {metadata?.workflow && (
          <Box>
            <Text dimColor>via {metadata.workflow}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
