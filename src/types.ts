/**
 * Core types for the async-agent system
 */

/**
 * MCP Server configuration
 * Matches the Claude Agent SDK mcpServers format
 */
export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Collection of MCP server configurations
 * Key is the server name, value is the configuration
 */
export interface McpConnections {
  [serverName: string]: McpServerConfig;
}

/**
 * Response from agent execution
 */
export interface AgentResponse {
  /** The text response from the agent */
  text: string;

  /** Path to the working directory where agent files are stored */
  workingDirectory: string;

  /** Full conversation trace (all messages from the agent execution) */
  trace?: any[];
}

/**
 * File metadata structure
 */
export interface FileMetadata {
  name: string;
  url: string;
}

/**
 * Result record stored in database
 */
export interface ResultRecord {
  text: string;
  requestId: string;
  files: FileMetadata[];
  metadata?: Record<string, any>;
}

/**
 * Webhook request body
 */
export interface WebhookRequestBody {
  /** The user's prompt */
  prompt: string;

  /** Optional request identifier */
  requestId?: string;

  /** Optional system prompt override */
  systemPrompt?: string;

  /** Whether to run asynchronously (respond immediately) */
  async?: boolean;

  /** Additional metadata to pass through */
  metadata?: Record<string, any>;
}

/**
 * Webhook response
 */
export interface WebhookResponse {
  /** The agent's response text */
  response: string;

  /** Files generated during execution */
  files: FileMetadata[];

  /** Request identifier */
  requestId?: string;

  /** Conversation trace (for debugging) */
  trace?: any[];

  /** Workflow that was executed (if any) */
  workflowId?: string;
  workflow?: Workflow;
}

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  created_at?: string;
}

/**
 * Individual step within a workflow
 */
export interface WorkflowStep {
  id: number;
  prompt: string;
  guidance?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
}

/**
 * Result of workflow classification
 */
export interface ClassificationResult {
  workflowId: string | null;
  workflowData: Workflow | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reasoning?: string;
}

/**
 * Extended agent response with session ID (for workflow steps)
 */
export interface WorkflowAgentResponse extends AgentResponse {
  sessionId: string;
}

// Extend Express Request to include MCP connections
declare global {
  namespace Express {
    interface Request {
      /** MCP server connections populated by connections middleware */
      mcpConnections?: McpConnections;

      /** Correlation ID for request tracking */
      correlationId?: string;

      /** Request start time for duration tracking */
      startTime?: number;
    }
  }
}
