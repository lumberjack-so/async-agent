/**
 * Execution History Browser
 * Browse and view past task executions
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { Execution } from '@prisma/client';

interface ExecutionHistoryProps {
  onBack: () => void;
  onSelect?: (execution: Execution) => void;
}

export const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({ onBack, onSelect }) => {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const { default: prisma } = await import('../../db/client.js');

      const results = await prisma.execution.findMany({
        orderBy: { startedAt: 'desc' },
        take: 50,
      });

      setExecutions(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms?: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCost = (cost?: any) => {
    if (!cost) return '$0.00';
    // Handle Prisma Decimal type
    const costNum = typeof cost === 'number' ? cost : parseFloat(cost.toString());
    return `$${costNum.toFixed(4)}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Text color="green">✓</Text>;
      case 'failed':
        return <Text color="red">✗</Text>;
      case 'running':
        return <Text color="yellow">⟳</Text>;
      default:
        return <Text color="gray">○</Text>;
    }
  };

  // Viewing specific execution
  if (selectedExecution) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={2}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color="cyan">
            Execution Details
          </Text>
        </Box>

        <Box flexDirection="column" paddingX={1}>
          <Box>
            <Text bold>Status: </Text>
            {getStatusIcon(selectedExecution.status)}
            <Box marginLeft={1}>
              <Text color={selectedExecution.status === 'completed' ? 'green' : 'red'}>
                {selectedExecution.status.toUpperCase()}
              </Text>
            </Box>
          </Box>

          <Box marginTop={1}>
            <Text bold>Execution ID: </Text>
            <Box marginLeft={1}>
              <Text dimColor>{selectedExecution.id}</Text>
            </Box>
          </Box>

          <Box marginTop={1}>
            <Text bold>Started: </Text>
            <Box marginLeft={1}>
              <Text>{formatDate(selectedExecution.startedAt)}</Text>
            </Box>
          </Box>

          {selectedExecution.skillId && (
            <Box marginTop={1}>
              <Text bold>Skill ID: </Text>
              <Box marginLeft={1}>
                <Text color="cyan">{selectedExecution.skillId.substring(0, 8)}...</Text>
              </Box>
            </Box>
          )}

          <Box marginTop={1}>
            <Text bold>Duration: </Text>
            <Box marginLeft={1}>
              <Text>{formatDuration(selectedExecution.durationMs)}</Text>
            </Box>
          </Box>

          <Box marginTop={1}>
            <Text bold>Tokens: </Text>
            <Box marginLeft={1}>
              <Text>{selectedExecution.tokenCount?.toLocaleString() || 'N/A'}</Text>
            </Box>
          </Box>

          <Box marginTop={1}>
            <Text bold>Cost: </Text>
            <Box marginLeft={1}>
              <Text color="yellow">{formatCost(selectedExecution.costUsd)}</Text>
            </Box>
          </Box>

          {selectedExecution.output && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>Output:</Text>
              <Box
                marginTop={0}
                marginLeft={2}
                paddingX={1}
                borderStyle="single"
                borderColor="gray"
              >
                <Text>
                  {typeof selectedExecution.output === 'string'
                    ? selectedExecution.output.substring(0, 200)
                    : JSON.stringify(selectedExecution.output).substring(0, 200)}
                  {(typeof selectedExecution.output === 'string'
                    ? selectedExecution.output.length
                    : JSON.stringify(selectedExecution.output).length) > 200 && '...'}
                </Text>
              </Box>
            </Box>
          )}
        </Box>

        <Box marginTop={1}>
          <SelectInput
            items={[{ label: '← Back to history', value: 'back' }]}
            onSelect={() => setSelectedExecution(null)}
          />
        </Box>
      </Box>
    );
  }

  // Main history list
  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={0}
        marginBottom={1}
      >
        <Text bold color="cyan">
          Execution History
        </Text>
      </Box>

      {loading ? (
        <Box paddingX={1}>
          <Text dimColor>Loading history...</Text>
        </Box>
      ) : error ? (
        <Box flexDirection="column" paddingX={1}>
          <Text color="red">✗ {error}</Text>
          <Box marginTop={1}>
            <SelectInput
              items={[{ label: 'Back to chat', value: 'back' }]}
              onSelect={onBack}
            />
          </Box>
        </Box>
      ) : executions.length === 0 ? (
        <Box flexDirection="column" paddingX={1}>
          <Text dimColor>No execution history found</Text>
          <Box marginTop={1}>
            <SelectInput
              items={[{ label: 'Back to chat', value: 'back' }]}
              onSelect={onBack}
            />
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box paddingX={1} marginBottom={1}>
            <Text dimColor>Showing {executions.length} most recent executions</Text>
          </Box>

          {executions.slice(0, 10).map((exec) => (
            <Box key={exec.id} paddingX={1} marginY={0}>
              {getStatusIcon(exec.status)}
              <Box marginLeft={1}>
                <Text dimColor>{formatDate(exec.startedAt)}</Text>
              </Box>
              <Box marginLeft={1}>
                <Text>
                  {exec.id.substring(0, 12)}... | {formatDuration(exec.durationMs)} |{' '}
                  {formatCost(exec.costUsd)}
                </Text>
              </Box>
            </Box>
          ))}

          <Box marginTop={1}>
            <SelectInput
              items={[
                ...executions.slice(0, 10).map((exec) => ({
                  label: `View: ${exec.id.substring(0, 20)}...`,
                  value: exec.id,
                })),
                { label: '← Back to chat', value: 'back' },
              ]}
              onSelect={(item) => {
                if (item.value === 'back') {
                  onBack();
                } else {
                  const exec = executions.find((e) => e.id === item.value);
                  if (exec) {
                    setSelectedExecution(exec);
                    onSelect?.(exec);
                  }
                }
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};
