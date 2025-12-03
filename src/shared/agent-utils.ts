/**
 * Shared Agent Utilities
 *
 * Common utility functions used across agent and workflow-agent modules.
 */

/**
 * Extract text response from agent result
 *
 * @param result - Agent execution result
 * @returns Extracted text response
 * @throws Error if result contains error information
 */
export function extractResponseText(result: any): string {
  if (!result) {
    return 'Agent completed successfully but returned no result.';
  }

  // Handle SDKResultMessage type
  if (result.type === 'result') {
    if (result.subtype === 'success' && result.result) {
      return result.result;
    }
    if (result.subtype?.startsWith('error_') && result.errors) {
      const errorMsg = result.errors.join('\n');
      throw new Error(`Agent execution failed: ${errorMsg}`);
    }
  }

  // Fallback: try common response fields
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object') {
    if (result.text) return result.text;
    if (result.response) return result.response;
    if (result.content) return result.content;
    if (result.message) return result.message;

    return JSON.stringify(result, null, 2);
  }

  return 'Agent completed successfully but returned no text response.';
}

/**
 * Get default system prompt for agent execution
 *
 * @returns Default system prompt string
 */
export function getDefaultSystemPrompt(): string {
  return `You are a helpful AI assistant with access to various tools through MCP servers.

Use the available tools to help answer the user's questions and complete their requests.
Be concise and clear in your responses.
If you create files, mention them in your response.`;
}

/**
 * Log agent message based on type with configurable prefix
 *
 * @param message - Agent message to log
 * @param messageCount - Current message count
 * @param prefix - Optional log prefix (defaults to 'Agent')
 */
export function logAgentMessage(
  message: any,
  messageCount: number,
  prefix: string = 'Agent'
): void {
  if (message.type === 'system' && message.subtype === 'init') {
    console.log(`\n[${prefix}] SYSTEM INIT (message ${messageCount})`);
    console.log(`[${prefix}]   Model: ${message.model}`);
    console.log(`[${prefix}]   Permission Mode: ${message.permissionMode}`);
    console.log(
      `[${prefix}]   Available Tools: ${message.tools?.slice(0, 10).join(', ')}${message.tools?.length > 10 ? '...' : ''} (${message.tools?.length || 0} total)`
    );
    console.log(
      `[${prefix}]   MCP Servers: ${message.mcp_servers?.map((s: any) => `${s.name} (${s.status})`).join(', ') || 'none'}`
    );
  } else if (message.type === 'user') {
    console.log(`\n[${prefix}] USER MESSAGE (message ${messageCount})`);
    const content = message.message?.content;
    if (typeof content === 'string') {
      console.log(
        `[${prefix}]   Content: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`
      );
    }
  } else if (message.type === 'assistant') {
    console.log(`\n[${prefix}] ASSISTANT MESSAGE (message ${messageCount})`);
    const content = message.message?.content;
    if (Array.isArray(content)) {
      content.forEach((block: any) => {
        if (block.type === 'text') {
          console.log(
            `[${prefix}]   Text: ${block.text.substring(0, 300)}${block.text.length > 300 ? '...' : ''}`
          );
        } else if (block.type === 'tool_use') {
          console.log(`[${prefix}]   Tool Call: ${block.name}`);
          console.log(
            `[${prefix}]      Input: ${JSON.stringify(block.input).substring(0, 200)}...`
          );
        }
      });
    }
  } else if (message.type === 'result') {
    console.log(`\n[${prefix}] RESULT (message ${messageCount})`);
    console.log(`[${prefix}]   Subtype: ${message.subtype}`);
    console.log(
      `[${prefix}]   Duration: ${(message.duration_ms / 1000).toFixed(2)}s`
    );
    console.log(`[${prefix}]   Turns: ${message.num_turns}`);
    console.log(`[${prefix}]   Cost: $${message.total_cost_usd?.toFixed(4) || '0'}`);
    if (message.subtype === 'success' && message.result) {
      console.log(
        `[${prefix}]   Result: ${message.result.substring(0, 300)}${message.result.length > 300 ? '...' : ''}`
      );
    }
  }
}

/**
 * Parse disallowed tools from environment variable
 *
 * @returns Array of disallowed tool names, or empty array if not set
 */
export function parseDisallowedTools(): string[] {
  const disallowedToolsEnv = process.env.DISALLOWED_TOOLS;

  if (!disallowedToolsEnv) {
    return [];
  }

  return disallowedToolsEnv
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
