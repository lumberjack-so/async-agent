/**
 * Unified Agent Executor
 *
 * Central facade for all agent execution modes:
 * - classifier: Only classify, return match info (no execution)
 * - orchestrator: Classify and execute if match found, fallback to default
 * - default: Skip classification, execute as regular one-off agent
 */

import { executeAgent } from './agent.js';
import { classifyWorkflow } from './workflow-classifier.js';
import { executeWorkflowOrchestrator } from './workflow-orchestrator.js';
import {
  ExecutionMode,
  McpConnections,
  ClassificationResult,
  Workflow,
  AgentResponse
} from './types.js';

/**
 * Options for unified agent execution
 */
export interface ExecuteOptions {
  /** Execution mode */
  mode: ExecutionMode;

  /** User's prompt */
  prompt: string;

  /** Unique request identifier */
  requestId: string;

  /** MCP server connections */
  mcpConnections: McpConnections;

  /** Optional system prompt override */
  systemPrompt?: string;

  /** Optional user prompt prefix */
  userPromptPrefix?: string;

  /** Correlation ID for logging */
  correlationId: string;
}

/**
 * Result of unified agent execution
 */
export interface ExecutionResult {
  /** Agent's response text */
  text: string;

  /** Working directory (null for classifier mode) */
  workingDirectory: string | null;

  /** Conversation trace (for debugging) */
  trace?: any[];

  /** Classification result (present for classifier/orchestrator modes) */
  classification?: ClassificationResult;

  /** Workflow that was executed (present if workflow was executed) */
  workflow?: Workflow;

  /** Execution step metadata (for workflows) */
  steps?: any[];
}

/**
 * Format classification result into user-friendly text
 */
function formatClassificationResult(classification: ClassificationResult): string {
  if (!classification.workflowId || !classification.workflowData) {
    return `Classification Result:\n\nNo matching workflow found.\nConfidence: ${classification.confidence}\n${classification.reasoning ? `Reasoning: ${classification.reasoning}\n` : ''}\nIn orchestrator mode, this would fallback to one-off agent execution.`;
  }

  const workflow = classification.workflowData;
  return `Classification Result:\n\nMatched Workflow: ${workflow.name}\nWorkflow ID: ${classification.workflowId}\nConfidence: ${classification.confidence}\n${classification.reasoning ? `Reasoning: ${classification.reasoning}\n` : ''}\nSteps: ${workflow.steps.length}\n\nNo execution performed (classifier mode).`;
}

/**
 * Execute agent with specified mode
 *
 * Routes execution based on mode:
 * - classifier: Only classify
 * - orchestrator: Classify then execute if match
 * - default: Direct execution
 */
export async function executeWithMode(options: ExecuteOptions): Promise<ExecutionResult> {
  const {
    mode,
    prompt,
    requestId,
    mcpConnections,
    systemPrompt,
    userPromptPrefix,
    correlationId,
  } = options;

  switch (mode) {
    case 'classifier': {
      // Only classify, don't execute
      console.log(`[Agent Executor] Mode: classifier - classifying only`);

      const classification = await classifyWorkflow(prompt);

      return {
        text: formatClassificationResult(classification),
        workingDirectory: null,
        classification,
      };
    }

    case 'orchestrator': {
      // Classify first, then execute if match found
      console.log(`[Agent Executor] Mode: orchestrator - classify then execute`);

      const classification = await classifyWorkflow(prompt);

      if (classification.workflowId && classification.workflowData) {
        // Workflow match found - execute via orchestrator
        console.log(
          `[Agent Executor] Workflow matched: ${classification.workflowData.name} - executing orchestrator`
        );

        const result = await executeWorkflowOrchestrator(
          classification.workflowData,
          prompt,
          requestId,
          mcpConnections,
          systemPrompt
        );

        return {
          ...result,
          classification,
          workflow: classification.workflowData,
        };
      } else {
        // No match - fallback to default agent
        console.log(`[Agent Executor] No workflow match - falling back to default agent`);

        const result = await executeAgent({
          prompt,
          requestId,
          mcpConnections,
          systemPrompt,
          userPromptPrefix,
        });

        return {
          ...result,
          classification, // Include classification result showing no match
        };
      }
    }

    case 'default':
    default: {
      // Skip classification, direct execution
      console.log(`[Agent Executor] Mode: default - direct execution`);

      const result = await executeAgent({
        prompt,
        requestId,
        mcpConnections,
        systemPrompt,
        userPromptPrefix,
      });

      return result;
    }
  }
}
