/**
 * Alfred TUI - Main Interactive Terminal UI
 * Full-screen persistent TUI similar to Claude Code
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { ChatInput } from './ChatInput.js';
import { MessageHistory } from './MessageHistory.js';
import { StreamingOutput } from './StreamingOutput.js';
import { SkillsMenu } from './SkillsMenu.js';
import { ExecutionHistory } from './ExecutionHistory.js';
import { TokenUsageDisplay } from './TokenUsageDisplay.js';

type AppMode = 'chat' | 'skills' | 'streaming' | 'history';

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

interface AlfredTUIProps {
  onExit?: () => void;
}

export const AlfredTUI: React.FC<AlfredTUIProps> = ({ onExit }) => {
  const { exit } = useApp();
  const [mode, setMode] = useState<AppMode>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome to Alfred! Type your prompt or use /commands for special functions.',
      timestamp: new Date(),
    },
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingRequestId, setStreamingRequestId] = useState<string | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  // Handle Escape key to exit
  useInput((input, key) => {
    if (key.escape) {
      if (isStreaming) {
        // First escape: stop streaming
        setIsStreaming(false);
        setStreamingRequestId(null);
        addSystemMessage('Interrupted');
      } else {
        // Second escape: exit
        exit();
        onExit?.();
      }
    }
  });

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id: Date.now().toString(),
        timestamp: new Date(),
      },
    ]);
  };

  const addSystemMessage = (content: string) => {
    addMessage({ type: 'system', content });
  };

  const handleSubmit = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Check for slash commands
    if (trimmed.startsWith('/')) {
      handleSlashCommand(trimmed);
      return;
    }

    // Check for async mode
    const hasAsync = trimmed.toLowerCase().endsWith(' async');
    const prompt = hasAsync ? trimmed.slice(0, -6).trim() : trimmed;

    // Add user message
    addMessage({
      type: 'user',
      content: trimmed,
    });

    // Start streaming
    setIsStreaming(true);
    setMode('streaming');

    try {
      // Call API with streaming
      await executeWithStreaming(prompt, hasAsync);
    } catch (error) {
      addMessage({
        type: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsStreaming(false);
      setMode('chat');
    }
  };

  const handleSlashCommand = (command: string) => {
    const cmd = command.toLowerCase().split(' ')[0];

    switch (cmd) {
      case '/skills':
        setMode('skills');
        break;
      case '/history':
        setMode('history');
        break;
      case '/health':
        checkHealth();
        break;
      case '/clear':
        setMessages([]);
        setTotalTokens(0);
        setTotalCost(0);
        addSystemMessage('Chat cleared');
        break;
      case '/help':
        showHelp();
        break;
      default:
        addSystemMessage(`Unknown command: ${cmd}`);
        showHelp();
    }
  };

  const checkHealth = async () => {
    addSystemMessage('Checking system health...');
    try {
      const { api } = await import('../lib/api-client.js');
      const health = await api.health();
      addMessage({
        type: 'system',
        content: `✓ System healthy
Status: ${health.status}
Uptime: ${health.uptime || 'N/A'}
Database: ${health.database || 'connected'}`,
      });
    } catch (error) {
      addMessage({
        type: 'system',
        content: `✗ Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const showHelp = () => {
    addMessage({
      type: 'system',
      content: `Available commands:
  /skills    - Manage skills (list, create, edit, delete)
  /history   - Browse execution history
  /health    - Check system health
  /clear     - Clear chat history
  /help      - Show this help message

Tips:
  • Type your prompt and press Enter to execute
  • Add "async" at the end to run asynchronously
  • Press Escape to interrupt streaming or exit
      `,
    });
  };

  const executeWithStreaming = async (prompt: string, isAsync: boolean) => {
    try {
      // Import API client
      const { api } = await import('../lib/api-client.js');

      // Send request to alfred
      const response = await api.run({
        prompt,
        async: isAsync,
      });

      const requestId = response.requestId;
      // TODO: Webhook needs to return executionId for SSE streaming
      const executionId = response.executionId || requestId;
      setStreamingRequestId(executionId);

      if (isAsync) {
        // Async mode - just show confirmation
        addMessage({
          type: 'assistant',
          content: `✓ Task submitted asynchronously\nRequest ID: ${requestId}`,
          metadata: { requestId },
        });
        return;
      }

      // Sync mode with streaming - connect to SSE
      const baseUrl = process.env.ALFRED_URL || 'http://localhost:3001';
      const eventSource = new EventSource(`${baseUrl}/stream/${executionId}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              addMessage({
                type: 'assistant',
                content: '⟳ Connected to alfred...',
              });
              break;

            case 'step':
              const step = data.step;
              const icon =
                step.status === 'complete' ? '✓' : step.status === 'error' ? '✗' : '→';
              addMessage({
                type: 'assistant',
                content: `${icon} ${step.title}${step.duration ? ` (${step.duration}ms)` : ''}`,
              });
              break;

            case 'complete':
              eventSource.close();
              setIsStreaming(false);
              setStreamingRequestId(null);

              // Update totals
              if (data.metadata?.tokenCount) {
                setTotalTokens((prev) => prev + data.metadata.tokenCount);
              }
              if (data.metadata?.cost) {
                setTotalCost((prev) => prev + data.metadata.cost);
              }

              addMessage({
                type: 'assistant',
                content: data.output || response.response || 'Task completed',
                metadata: {
                  requestId,
                  cost: data.metadata?.cost,
                  duration: data.metadata?.duration,
                },
              });
              break;

            case 'error':
              eventSource.close();
              setIsStreaming(false);
              setStreamingRequestId(null);

              addMessage({
                type: 'system',
                content: `✗ Error: ${data.message || 'Unknown error'}`,
              });
              break;
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        setIsStreaming(false);
        setStreamingRequestId(null);

        // Fallback: show the response we got from the initial request
        if (response.response) {
          addMessage({
            type: 'assistant',
            content: response.response,
            metadata: {
              requestId,
              cost: response.metadata?.totalCost,
              duration: response.metadata?.executionTime,
            },
          });
        }
      };
    } catch (error) {
      setIsStreaming(false);
      setStreamingRequestId(null);
      throw error;
    }
  };

  // Render different modes
  if (mode === 'skills') {
    return (
      <SkillsMenu
        onBack={() => {
          setMode('chat');
          addSystemMessage('Returned to chat');
        }}
      />
    );
  }

  if (mode === 'history') {
    return (
      <ExecutionHistory
        onBack={() => {
          setMode('chat');
          addSystemMessage('Returned to chat');
        }}
      />
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={0}
        marginBottom={1}
      >
        <Text bold color="cyan">
          Alfred - Async Agent TUI
        </Text>
        <Box flexGrow={1} />
        {totalTokens > 0 && (
          <Box marginRight={2}>
            <TokenUsageDisplay
              tokenCount={totalTokens}
              cost={totalCost}
              model="claude-haiku-4-5"
            />
          </Box>
        )}
        <Text dimColor>v1.0.0</Text>
      </Box>

      {/* Message History */}
      <Box flexDirection="column" flexGrow={1} marginBottom={1}>
        <MessageHistory messages={messages} />
      </Box>

      {/* Streaming Output (if active) */}
      {isStreaming && mode === 'streaming' && (
        <Box marginBottom={1}>
          <StreamingOutput requestId={streamingRequestId} />
        </Box>
      )}

      {/* Input Area */}
      <ChatInput
        value={currentInput}
        onChange={setCurrentInput}
        onSubmit={handleSubmit}
        disabled={isStreaming}
        placeholder="Type your message or /command..."
      />

      {/* Status Bar */}
      <Box marginTop={1}>
        <Text dimColor>
          {isStreaming ? (
            <Text color="yellow">⟳ Processing... (Press Escape to interrupt)</Text>
          ) : (
            <Text>
              Press <Text color="cyan">Enter</Text> to send • <Text color="cyan">/help</Text> for
              commands • <Text color="cyan">Escape</Text> to exit
            </Text>
          )}
        </Text>
      </Box>
    </Box>
  );
};
