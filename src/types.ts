/**
 * Core types for the async-agent system
 */

/**
 * Agent execution mode
 * - classifier: Only classify the prompt, return match info (no execution)
 * - orchestrator: Classify and execute if workflow match found, fallback to default
 * - default: Skip classification, execute as regular one-off agent
 */
export type ExecutionMode = 'classifier' | 'orchestrator' | 'default';

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

  /** Execution step metadata (for workflows) */
  steps?: ExecutionStepMetadata[];
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

  /** Execution mode - defaults to 'default' */
  mode?: ExecutionMode;

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
 * Execution step metadata
 */
export interface ExecutionStepMetadata {
  id: number;
  duration_ms: number;
  total_cost_usd: number;
  num_turns: number;
}

/**
 * Webhook response
 */
export interface WebhookResponse {
  /** The actual response text from the agent */
  response: string;

  /** Array of file URLs generated */
  url: string[];

  /** Request identifier */
  requestId: string;

  /** Execution ID for SSE streaming */
  executionId?: string;

  /** Execution metadata */
  metadata?: {
    workflowId?: string;
    workflowName?: string;
    steps?: ExecutionStepMetadata[];
  };
}

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  connectionNames?: string[];  // Skill-level connection names (fallback for steps)
  created_at?: string;
}

/**
 * Individual step within a workflow
 */
export interface WorkflowStep {
  id: number;
  prompt: string;
  guidance?: string;
  allowedTools?: string[];      // SDK tools, MCP tool names, MCP server names
  disallowedTools?: string[];   // SDK tools, MCP tool names, MCP server names
  connectionNames?: string[];   // Per-step connection names (fallback to skill-level)
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

/**
 * Resolved MCP connection configuration from database
 */
export interface ResolvedConnection {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  tools: string[];  // Available tool names from this connection
}

/**
 * Connection resolution result for a workflow step
 */
export interface StepConnections {
  mcpConnections: McpConnections;      // For Claude SDK
  availableTools: string[];            // All tool names from connections
  connectionNames: string[];           // Resolved connection names used
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
