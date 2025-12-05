/**
 * Streaming Output Component
 * Displays real-time progress updates during task execution
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface StreamingStep {
  id: number;
  status: 'pending' | 'running' | 'complete' | 'error';
  title: string;
  duration?: number;
  error?: string;
}

interface StreamingOutputProps {
  requestId: string | null;
}

export const StreamingOutput: React.FC<StreamingOutputProps> = ({ requestId }) => {
  const [steps, setSteps] = useState<StreamingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // TODO: Connect to SSE endpoint or WebSocket
    // For now, simulate streaming steps
    const simulateSteps = async () => {
      const demoSteps: StreamingStep[] = [
        { id: 1, status: 'pending', title: 'Analyzing request' },
        { id: 2, status: 'pending', title: 'Classifying task' },
        { id: 3, status: 'pending', title: 'Executing agent' },
        { id: 4, status: 'pending', title: 'Processing response' },
      ];

      setSteps(demoSteps);

      // Simulate step progression
      for (let i = 0; i < demoSteps.length; i++) {
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === i
              ? { ...step, status: 'running' }
              : idx < i
              ? { ...step, status: 'complete' }
              : step
          )
        );
        setCurrentStep(i);

        await new Promise((resolve) => setTimeout(resolve, 800));

        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === i ? { ...step, status: 'complete', duration: 800 } : step
          )
        );
      }
    };

    if (requestId) {
      simulateSteps();
    }
  }, [requestId]);

  const renderStepIcon = (status: StreamingStep['status']) => {
    switch (status) {
      case 'pending':
        return <Text color="gray">○</Text>;
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
      default:
        return <Text>-</Text>;
    }
  };

  if (!requestId || steps.length === 0) {
    return null;
  }

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
      flexDirection="column"
    >
      <Text bold color="cyan">
        Processing...
      </Text>

      {steps.map((step) => (
        <Box key={step.id} marginY={0}>
          {renderStepIcon(step.status)}
          <Box marginLeft={1}>
            <Text>{step.title}</Text>
          </Box>
          {step.duration && step.status === 'complete' && (
            <Box marginLeft={1}>
              <Text dimColor>({step.duration}ms)</Text>
            </Box>
          )}
          {step.error && (
            <Box marginLeft={1}>
              <Text color="red">{step.error}</Text>
            </Box>
          )}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor>
          Step {currentStep + 1} of {steps.length}
        </Text>
      </Box>
    </Box>
  );
};
