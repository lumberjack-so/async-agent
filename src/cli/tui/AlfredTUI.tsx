/**
 * Alfred TUI - Main Interactive Terminal UI
 * Full-screen persistent TUI similar to Claude Code
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { EventSource } from 'eventsource';
import { ChatInput } from './ChatInput.js';
import { MessageHistory } from './MessageHistory.js';
import { StreamingOutput } from './StreamingOutput.js';
import { SkillsMenu } from './SkillsMenu.js';
import { ExecutionHistory } from './ExecutionHistory.js';
import { TokenUsageDisplay } from './TokenUsageDisplay.js';
import { WorkflowProgress, WorkflowStep } from './WorkflowProgress.js';
import { Header } from './Header.js';
import { StatusBar } from './StatusBar.js';
import { SuccessCard } from './SuccessCard.js';
import { ErrorCard, getErrorSuggestion } from './ErrorCard.js';
import { brand } from './theme.js';

type AppMode = 'chat' | 'skills' | 'streaming' | 'history';
type ExecutionMode = 'orchestrator' | 'classifier' | 'default';

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
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('orchestrator');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: `Welcome to ${brand.name}! ${brand.tagline}\nType your prompt or use /commands for special functions.`,
      timestamp: new Date(),
    },
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingRequestId, setStreamingRequestId] = useState<string | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  // Workflow progress state
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  // Handle keyboard shortcuts
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

    // Tab: cycle through execution modes (only in chat mode and when not streaming)
    if (key.tab && mode === 'chat' && !isStreaming) {
      const modes: ExecutionMode[] = ['orchestrator', 'classifier', 'default'];
      const currentIndex = modes.indexOf(executionMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setExecutionMode(modes[nextIndex]);
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
  • Press Tab to cycle execution mode (orchestrator/classifier/default)
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

      // Generate requestId upfront
      const requestId = `req-${Date.now()}`;
      const executionId = requestId;

      // For sync mode with streaming: Connect to SSE FIRST, then trigger execution
      if (!isAsync) {
        const baseUrl = process.env.ALFRED_URL || 'http://localhost:3001';
        const eventSource = new EventSource(`${baseUrl}/stream/${executionId}`);

        setStreamingRequestId(executionId);

        // Set up event handlers BEFORE sending request
        eventSource.onmessage = (event: any) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[TUI] SSE event received:', data.type, data);

            switch (data.type) {
              case 'connected':
                addMessage({
                  type: 'assistant',
                  content: '⟳ Connected to Alfred...',
                });
                break;

              case 'commentary':
                // Show conversational commentary messages
                addMessage({
                  type: 'assistant',
                  content: data.message,
                });
                break;

              case 'workflow':
                // Initialize workflow progress - show all steps upfront
                setWorkflowName(data.workflow.name);
                setWorkflowSteps(data.workflow.steps);
                break;

              case 'step':
                // Update existing workflow step (don't append new message)
                const step = data.step;
                setWorkflowSteps((prev) =>
                  prev.map((s) =>
                    s.id === step.id
                      ? {
                          ...s,
                          status: step.status,
                          duration: step.duration,
                          // Clear details when step completes
                          details: step.status === 'complete' ? [] : s.details,
                        }
                      : s
                  )
                );
                break;

              case 'step_detail':
                // Add detail to current step's details array
                const { stepId, detail } = data;
                console.log(`[TUI] step_detail event: stepId=${stepId}, detail=${detail}`);
                setWorkflowSteps((prev) => {
                  const updated = prev.map((s) =>
                    s.id === stepId
                      ? {
                          ...s,
                          details: [...(s.details || []), detail],
                        }
                      : s
                  );
                  console.log('[TUI] Updated workflow steps:', updated.map(s => ({ id: s.id, status: s.status, detailsCount: s.details?.length || 0 })));
                  return updated;
                });
                break;

              case 'complete':
                eventSource.close();
                setIsStreaming(false);
                setStreamingRequestId(null);

                // Clear workflow state
                setWorkflowName(null);
                setWorkflowSteps([]);

                // Update totals
                if (data.metadata?.tokenCount) {
                  setTotalTokens((prev) => prev + data.metadata.tokenCount);
                }
                if (data.metadata?.cost) {
                  setTotalCost((prev) => prev + data.metadata.cost);
                }

                // Add success card as a message (will be rendered by MessageHistory)
                addMessage({
                  type: 'assistant',
                  content: `SUCCESS:${JSON.stringify({
                    result: data.output || 'Task completed',
                    duration: data.metadata?.duration,
                    cost: data.metadata?.cost,
                    metadata: data.metadata,
                  })}`,
                  metadata: {
                    requestId: executionId,
                    cost: data.metadata?.cost,
                    duration: data.metadata?.duration,
                    workflow: data.metadata?.workflow,
                  },
                });
                break;

              case 'error':
                eventSource.close();
                setIsStreaming(false);
                setStreamingRequestId(null);

                // Clear workflow state
                setWorkflowName(null);
                setWorkflowSteps([]);

                // Create error object and get suggestion
                const error = new Error(data.message || 'Unknown error');
                const suggestion = getErrorSuggestion(error);

                // Add error card as a message (will be rendered by MessageHistory)
                addMessage({
                  type: 'system',
                  content: `ERROR:${JSON.stringify({
                    message: error.message,
                    suggestion,
                  })}`,
                });
                break;
            }
          } catch (err) {
            console.error('Failed to parse SSE message:', err);
          }
        };

        eventSource.onerror = (error: any) => {
          console.error('SSE error:', error);
          eventSource.close();
          setIsStreaming(false);
          setStreamingRequestId(null);
        };

        // Small delay to ensure SSE connection is established
        await new Promise(resolve => setTimeout(resolve, 100));

        // NOW send the request (will execute and send events to our already-connected SSE)
        api.run({
          prompt,
          async: false,
          mode: executionMode,
          requestId: requestId,
        }).catch((error) => {
          console.error('Webhook error:', error);
          eventSource.close();
          setIsStreaming(false);
          addMessage({
            type: 'system',
            content: `✗ Request failed: ${error.message}`,
          });
        });

        return;
      }

      // Async mode - send request and just show confirmation
      const response = await api.run({
        prompt,
        async: true,
        mode: executionMode,
        requestId: requestId,
      });

      addMessage({
        type: 'assistant',
        content: `✓ Task submitted asynchronously\nRequest ID: ${requestId}`,
        metadata: { requestId },
      });
      return;
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
      <Header mode={executionMode} version={brand.version} />

      {/* Message History */}
      <Box flexDirection="column" flexGrow={1} marginBottom={1}>
        <MessageHistory messages={messages} />
      </Box>

      {/* Workflow Progress (animated todo list) */}
      {workflowSteps.length > 0 && (
        <Box marginBottom={1}>
          <WorkflowProgress
            steps={workflowSteps}
            workflowName={workflowName || undefined}
          />
        </Box>
      )}

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
        <StatusBar isStreaming={isStreaming} mode={mode} canInterrupt={isStreaming} />
      </Box>
    </Box>
  );
};
