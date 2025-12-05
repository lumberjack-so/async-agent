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

type AppMode = 'chat' | 'skills' | 'streaming' | 'menu';

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
      // TODO: Call API with streaming
      // For now, simulate
      await simulateStreaming(prompt, hasAsync);
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
      case '/health':
        addSystemMessage('Checking system health...');
        // TODO: Call health endpoint
        break;
      case '/clear':
        setMessages([]);
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

  const showHelp = () => {
    addMessage({
      type: 'system',
      content: `Available commands:
  /skills    - Manage skills (list, create, edit, delete)
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

  const simulateStreaming = async (prompt: string, isAsync: boolean) => {
    // Simulate streaming response
    const steps = [
      '⟳ Analyzing request...',
      '→ Classified as: one-off task',
      '→ Executing agent...',
      '✓ Complete',
    ];

    for (const step of steps) {
      addMessage({
        type: 'assistant',
        content: step,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    addMessage({
      type: 'assistant',
      content: `Response to: "${prompt}"\n\nThis is a simulated response. The full streaming implementation will connect to your async-agent API.`,
      metadata: {
        requestId: 'req-' + Date.now(),
        cost: 0.0123,
        duration: 2500,
      },
    });
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
