/**
 * ErrorCard Component
 * Beautiful error display with suggestions and retry functionality
 * Following Alfred TUI Design System
 */

import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import { colors, borders } from './theme.js';

/**
 * Common error types with helpful suggestions
 */
export const errorSuggestions = {
  NETWORK_ERROR: 'Check your internet connection and try again',
  AUTH_ERROR: 'Your API key might be invalid. Run /health to check',
  TIMEOUT: 'This task is taking longer than expected. Try breaking it into smaller steps',
  RATE_LIMIT: "You're being rate limited. Wait a few seconds and try again",
} as const;

/**
 * Props for ErrorCard component
 */
export interface ErrorCardProps {
  /** The error object to display */
  error: Error;
  /** Optional helpful suggestion to show */
  suggestion?: string;
  /** Whether the user can retry the failed operation */
  canRetry?: boolean;
  /** Callback function when user presses R to retry */
  onRetry?: () => void;
}

/**
 * ErrorCard Component
 * Displays errors in a beautiful, non-threatening way with helpful suggestions
 *
 * @example
 * ```tsx
 * <ErrorCard
 *   error={new Error('Connection failed')}
 *   suggestion={errorSuggestions.NETWORK_ERROR}
 *   canRetry={true}
 *   onRetry={() => retryOperation()}
 * />
 * ```
 */
export const ErrorCard: React.FC<ErrorCardProps> = ({
  error,
  suggestion,
  canRetry = false,
  onRetry,
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.error}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      {/* Error header */}
      <Box marginBottom={1}>
        <Text color={colors.error} bold>
          {figures.cross} Something went wrong
        </Text>
      </Box>

      {/* Error message */}
      <Box marginBottom={suggestion || canRetry ? 1 : 0}>
        <Text>{error.message || 'An unexpected error occurred'}</Text>
      </Box>

      {/* Helpful suggestion with lightbulb icon and left border */}
      {suggestion && (
        <Box
          borderColor={colors.text.tertiary}
          borderLeft={true}
          paddingLeft={1}
          marginBottom={canRetry ? 1 : 0}
        >
          <Text dimColor>💡 {suggestion}</Text>
        </Box>
      )}

      {/* Retry button */}
      {canRetry && (
        <Box>
          <Text dimColor>Press </Text>
          <Text color={colors.primary} bold>
            R
          </Text>
          <Text dimColor> to retry</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Helper function to get suggestion based on error type
 * Automatically matches common error patterns
 */
export const getErrorSuggestion = (error: Error): string | undefined => {
  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
    return errorSuggestions.NETWORK_ERROR;
  }

  if (message.includes('auth') || message.includes('unauthorized') || message.includes('api key')) {
    return errorSuggestions.AUTH_ERROR;
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return errorSuggestions.TIMEOUT;
  }

  if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
    return errorSuggestions.RATE_LIMIT;
  }

  return undefined;
};

export default ErrorCard;
