/**
 * TypeScript type definitions for Claude Agent SDK messages
 *
 * These types represent the message structure returned by the
 * @anthropic-ai/claude-agent-sdk query() iterator.
 */

/**
 * MCP server status information in system init message
 */
export interface SDKMcpServer {
  name: string;
  status: string;
}

/**
 * System initialization message
 * Emitted at the start of an agent session
 */
export interface SDKSystemInitMessage {
  type: 'system';
  subtype: 'init';
  session_id: string;
  model: string;
  tools?: string[];
  mcp_servers?: SDKMcpServer[];
  permissionMode: string;
}

/**
 * Text content block in assistant messages
 */
export interface SDKTextBlock {
  type: 'text';
  text: string;
}

/**
 * Tool use content block in assistant messages
 */
export interface SDKToolUseBlock {
  type: 'tool_use';
  name: string;
  input: Record<string, any>;
}

/**
 * Union of all content block types
 */
export type SDKContentBlock = SDKTextBlock | SDKToolUseBlock;

/**
 * User message containing the user's input
 */
export interface SDKUserMessage {
  type: 'user';
  message: {
    content: string;
  };
}

/**
 * Assistant message containing model's response
 * Content can include text blocks and tool use blocks
 */
export interface SDKAssistantMessage {
  type: 'assistant';
  message: {
    content: SDKContentBlock[];
  };
}

/**
 * Result message indicating completion of agent execution
 * Includes success/error status, metrics, and final output
 */
export interface SDKResultMessage {
  type: 'result';
  subtype: 'success' | `error_${string}`;
  result?: string;
  errors?: string[];
  duration_ms: number;
  total_cost_usd?: number;
  num_turns: number;
}

/**
 * Union of all SDK message types
 */
export type SDKMessage =
  | SDKSystemInitMessage
  | SDKUserMessage
  | SDKAssistantMessage
  | SDKResultMessage;
