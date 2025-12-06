/**
 * Workflow Progress - Animated Todo List
 * Shows live workflow execution with dynamic status updates
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { ProgressBar } from '@inkjs/ui';
import figures from 'figures';
import { colors, getStatusColor } from './theme.js';

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
  // Debug: Log what data the component is receiving
  console.log('[WorkflowProgress] Rendering with steps:', steps.map(s => ({
    id: s.id,
    status: s.status,
    hasDetails: !!s.details,
    detailCount: s.details?.length || 0,
    details: s.details
  })));

  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.status === 'complete').length;
  const progressPercent = totalSteps > 0 ? completedSteps / totalSteps : 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="#B794F6"
      paddingX={2}
      paddingY={1}
    >
      {/* Workflow header with progress */}
      <Box marginBottom={1}>
        <Text bold color="#B794F6">📋 {workflowName || 'Workflow'}</Text>
        <Box flexGrow={1} />
        <Text dimColor>{completedSteps}/{totalSteps}</Text>
      </Box>

      {/* Overall progress bar */}
      <Box marginBottom={1}>
        <ProgressBar value={progressPercent} />
      </Box>

      {/* Step list */}
      <Box flexDirection="column">
        {steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
          />
        ))}
      </Box>
    </Box>
  );
};

const StepItem: React.FC<{
  step: WorkflowStep;
  index: number;
  isLast: boolean;
}> = ({ step, index, isLast }) => {
  const icon = getStepIcon(step.status);
  const color = getStatusColor(step.status);
  const isRunning = step.status === 'running';

  return (
    <Box flexDirection="column">
      {/* Connection line to previous step */}
      {index > 0 && (
        <Box marginLeft={1}>
          <Text dimColor>│</Text>
        </Box>
      )}

      {/* Step title */}
      <Box>
        {/* Status icon */}
        <Box marginRight={1} width={2}>
          {isRunning ? (
            <Text color={color}><Spinner type="dots" /></Text>
          ) : (
            <Text color={color}>{icon}</Text>
          )}
        </Box>

        {/* Step content */}
        <Box flexDirection="column" flexGrow={1}>
          <Text color={color} bold={isRunning}>
            Step {step.id}: {step.title}
          </Text>

          {/* Expanded details for running step ONLY */}
          {isRunning && step.details && step.details.length > 0 && (
            <Box
              flexDirection="column"
              marginLeft={2}
              marginTop={0}
              paddingLeft={1}
              borderLeft={true}
              borderColor="#4A5568"
            >
              {step.details.map((detail, idx) => (
                <Box key={idx}>
                  <Text dimColor>⎿ </Text>
                  <Text color="#A0AEC0">{detail}</Text>
                </Box>
              ))}
            </Box>
          )}

          {/* Duration badge for completed steps */}
          {step.status === 'complete' && step.duration && (
            <Box marginTop={0}>
              <Text dimColor>⏱ {(step.duration / 1000).toFixed(1)}s</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Connection line to next step */}
      {!isLast && (
        <Box marginLeft={1}>
          <Text dimColor>│</Text>
        </Box>
      )}
    </Box>
  );
};

const getStepIcon = (status: WorkflowStep['status']): string => {
  const icons = {
    'pending': figures.circleDotted,   // ◌
    'running': '',                      // (animated spinner)
    'complete': figures.tick,           // ✓
    'error': figures.cross,             // ✗
  };
  return icons[status] || figures.circleDotted;
};
