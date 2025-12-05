/**
 * Workflow Progress - Animated Todo List
 * Shows live workflow execution with dynamic status updates
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface WorkflowStep {
  id: number;
  title: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  duration?: number;
  details?: string[];  // Step execution details (tool usage, etc.)
}

interface WorkflowProgressProps {
  steps: WorkflowStep[];
  currentStepId?: number;
  workflowName?: string;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  steps,
  currentStepId,
  workflowName,
}) => {
  const getStepIcon = (step: WorkflowStep) => {
    switch (step.status) {
      case 'pending':
        return <Text dimColor>○</Text>;
      case 'running':
        return (
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
        );
      case 'complete':
        return <Text color="green">✓</Text>;
      case 'error':
        return <Text color="red">✗</Text>;
    }
  };

  const getStepColor = (step: WorkflowStep) => {
    switch (step.status) {
      case 'pending':
        return 'gray';
      case 'running':
        return 'cyan';
      case 'complete':
        return 'green';
      case 'error':
        return 'red';
    }
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {workflowName && (
        <Box marginBottom={1}>
          <Text color="magenta" bold>
            📋 {workflowName}
          </Text>
        </Box>
      )}

      {steps.map((step) => (
        <Box key={step.id} flexDirection="column" marginY={0}>
          <Box>
            <Box marginRight={1}>{getStepIcon(step)}</Box>
            <Text color={getStepColor(step)}>
              Step {step.id}: {step.title}
              {step.duration && step.status === 'complete'
                ? ` (${(step.duration / 1000).toFixed(1)}s)`
                : ''}
            </Text>
          </Box>

          {/* Show details only for running steps */}
          {step.status === 'running' && step.details && step.details.length > 0 && (
            <Box flexDirection="column" marginLeft={3}>
              {step.details.map((detail, idx) => (
                <Box key={idx}>
                  <Text dimColor>⎿  {detail}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};
