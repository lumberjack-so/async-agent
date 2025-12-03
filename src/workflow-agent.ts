/**
 * Workflow Agent
 *
 * Executes individual workflow steps using Claude Agent SDK.
 * Supports session forking for multi-step workflows.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { WorkflowStep, McpConnections, WorkflowAgentResponse } from './types.js';
import { loadSystemPrompt } from './prompts.js';
import { config } from './config/index.js';
import { extractResponseText, parseDisallowedTools } from './shared/agent-utils.js';
import type { SDKMessage, SDKSystemInitMessage } from './shared/sdk-types.js';

// Parse global disallowed tools from environment
const GLOBAL_DISALLOWED_TOOLS = parseDisallowedTools();

export interface ExecuteWorkflowAgentOptions {
  step: WorkflowStep;
  userPrompt: string;
  requestId: string;
  workingDirectory: string;
  mcpConnections: McpConnections;
  sessionId: string | null;
  forkSession: boolean;
  systemPrompt?: string;
}

/**
 * Execute a single workflow step as an agent call
 */
export async function executeWorkflowAgent(
  options: ExecuteWorkflowAgentOptions
): Promise<WorkflowAgentResponse> {
  const {
    step,
    userPrompt,
    requestId,
    workingDirectory,
    mcpConnections,
    sessionId,
    forkSession,
    systemPrompt,
  } = options;

  try {
    // Build step-specific system prompt
    const baseSystemPrompt = systemPrompt || (await loadSystemPrompt());
    const stepSystemPrompt = buildStepSystemPrompt(baseSystemPrompt, step);

    // Construct step prompt
    const stepUserPrompt = constructStepPrompt(userPrompt, step);

    // Build tool restrictions
    const { disallowedTools } = buildToolRestrictions(step, mcpConnections);

    console.log(`[WorkflowAgent] ========================================`);
    console.log(`[WorkflowAgent] Executing step ${step.id}`);
    console.log(`[WorkflowAgent] Prompt: "${step.prompt.substring(0, 100)}..."`);
    console.log(`[WorkflowAgent] Fork session: ${forkSession}`);
    console.log(`[WorkflowAgent] Session ID: ${sessionId || 'NEW'}`);
    console.log(`[WorkflowAgent] Working directory: ${workingDirectory}`);
    console.log(
      `[WorkflowAgent] MCP servers: ${Object.keys(mcpConnections).join(', ') || 'none'}`
    );
    console.log(
      `[WorkflowAgent] Disallowed tools count: ${disallowedTools ? disallowedTools.length : 0}`
    );
    console.log(`[WorkflowAgent] ========================================`);

    // Build query options
    const queryOptions: any = {
      model: config.workflow.agentModel,
      systemPrompt: stepSystemPrompt,
      mcpServers: mcpConnections,
      cwd: workingDirectory,
      permissionMode: 'bypassPermissions',
    };

    // Add session management for forking
    if (forkSession && sessionId) {
      queryOptions.resume = sessionId;
      queryOptions.forkSession = true;
      console.log(`[WorkflowAgent] FORKING SESSION`);
      console.log(`[WorkflowAgent]    resume (from sessionId): ${sessionId}`);
    } else {
      console.log(
        `[WorkflowAgent] NEW SESSION (forkSession=${forkSession}, sessionId=${sessionId})`
      );
    }

    // Add tool restrictions
    if (disallowedTools !== undefined && disallowedTools.length > 0) {
      queryOptions.disallowedTools = disallowedTools;
    }

    // Execute agent
    const queryInstance = query({
      prompt: stepUserPrompt,
      options: queryOptions,
    });

    // Iterate through messages
    let finalResult: any = null;
    let messageCount = 0;
    let extractedSessionId: string | null = null;
    const conversationTrace: any[] = [];

    const executionPromise = (async () => {
      for await (const message of queryInstance) {
        messageCount++;
        conversationTrace.push(message);

        // Extract sessionId from system init message
        if (message.type === 'system' && message.subtype === 'init') {
          extractedSessionId = message.session_id || null;
          console.log(`[WorkflowAgent] INIT - session_id: ${extractedSessionId}`);
        }

        // Log messages
        if (message.type === 'result') {
          console.log(`\n[WorkflowAgent] Step ${step.id} RESULT`);
          console.log(
            `[WorkflowAgent]   Duration: ${(message.duration_ms / 1000).toFixed(2)}s`
          );
          console.log(
            `[WorkflowAgent]   Cost: $${message.total_cost_usd?.toFixed(4) || '0'}`
          );
          console.log(`[WorkflowAgent]   Turns: ${message.num_turns}`);
          finalResult = message;
        } else if (message.type === 'assistant') {
          const content = message.message?.content;
          if (Array.isArray(content)) {
            content.forEach((block: any) => {
              if (block.type === 'tool_use') {
                console.log(`[WorkflowAgent]   Tool: ${block.name}`);
              }
            });
          }
        }
      }
      return finalResult;
    })();

    const result = await Promise.race([
      executionPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Step ${step.id} execution timeout`)),
          config.agent.timeoutMs
        )
      ),
    ]);

    console.log(`[WorkflowAgent] Step ${step.id} completed\n`);

    // Extract response
    const responseText = extractResponseText(result);

    // Use extracted sessionId or fallback
    const finalSessionId =
      extractedSessionId || sessionId || `step-${step.id}-${requestId}`;

    console.log(`[WorkflowAgent] SESSION ID RESOLUTION`);
    console.log(`[WorkflowAgent]    Extracted: ${extractedSessionId}`);
    console.log(`[WorkflowAgent]    Input: ${sessionId}`);
    console.log(`[WorkflowAgent]    Final: ${finalSessionId}`);

    return {
      text: responseText,
      workingDirectory: workingDirectory,
      trace: conversationTrace,
      sessionId: finalSessionId,
    };
  } catch (error) {
    console.error(`[WorkflowAgent] Error executing step ${step.id}:`, error);

    if (error instanceof Error) {
      throw new Error(`Step ${step.id} execution failed: ${error.message}`);
    }

    throw new Error(`Step ${step.id} execution failed`);
  }
}

/**
 * Build step-specific system prompt
 */
function buildStepSystemPrompt(
  basePrompt: string,
  step: WorkflowStep
): string {
  const stepGuidance = `

## CURRENT WORKFLOW STEP

You are executing step ${step.id} of a multi-step workflow.

**Task**: ${step.prompt}

${step.guidance ? `**Guidance**: ${step.guidance}` : ''}

**Instructions**:
- Focus ONLY on completing this specific step
- You have access to previous conversation context
- Use only the tools available to you for this step
- Be concise and efficient
- Do not attempt to complete other workflow steps

Complete this task now.`;

  return basePrompt + stepGuidance;
}

/**
 * Construct step-specific user prompt
 */
function constructStepPrompt(originalPrompt: string, step: WorkflowStep): string {
  const AUTONOMY_INSTRUCTION = `

IMPORTANT: YOU ARE A HIGHLY AUTONOMOUS AGENT. YOU CAN MAKE DECISIONS AND INFER IF NOT ENOUGH DATA IS AVAILABLE. YOU MUST ALWAYS COMPLETE YOUR TASK WITHOUT FURTHER APPROVAL. NEVER ASK FOR CONFIRMATION, YOU ARE ON YOUR OWN.`;

  let basePrompt: string;

  // For step 1, include full original prompt
  if (step.id === 1) {
    basePrompt = `Original request: "${originalPrompt}"\n\n${step.prompt}`;
  } else {
    basePrompt = step.prompt;
  }

  // Add allowed tools guidance if specified
  let toolsGuidance = '';
  if (step.allowedTools && step.allowedTools.length > 0) {
    toolsGuidance = `\n\nUse these tools to complete your task: ${step.allowedTools.join(', ')}`;
  }

  return basePrompt + toolsGuidance + AUTONOMY_INSTRUCTION;
}

/**
 * SDK built-in tools
 */
const SDK_BUILTIN_TOOLS = [
  'Task',
  'Bash',
  'Glob',
  'Grep',
  'ExitPlanMode',
  'Read',
  'Edit',
  'Write',
  'NotebookEdit',
  'WebFetch',
  'TodoWrite',
  'WebSearch',
  'BashOutput',
  'KillShell',
  'Skill',
  'SlashCommand',
];

/**
 * Build tool restrictions for this step
 *
 * Uses disallowedTools approach (inverse of allowedTools)
 */
function buildToolRestrictions(
  step: WorkflowStep,
  mcpConnections: McpConnections
): {
  disallowedTools: string[] | undefined;
} {
  // Build list of all MCP tools from connections
  const mcpTools: string[] = [];
  for (const serverName of Object.keys(mcpConnections)) {
    // We don't know the exact tools without connecting, so we can't
    // build a complete disallowed list. For now, if allowedTools is
    // specified, we'll just trust the step config.
  }

  // If no allowedTools specified, allow everything
  if (!step.allowedTools) {
    // Just apply global disallowed tools
    return {
      disallowedTools:
        GLOBAL_DISALLOWED_TOOLS.length > 0 ? GLOBAL_DISALLOWED_TOOLS : undefined,
    };
  }

  // If allowedTools is empty array, disallow all SDK tools
  if (step.allowedTools.length === 0) {
    return {
      disallowedTools: [...SDK_BUILTIN_TOOLS, ...GLOBAL_DISALLOWED_TOOLS],
    };
  }

  // Calculate disallowed = all SDK tools - allowed tools
  const disallowedTools = SDK_BUILTIN_TOOLS.filter(
    (tool) => !step.allowedTools!.includes(tool)
  );

  // Add global disallowed tools
  for (const tool of GLOBAL_DISALLOWED_TOOLS) {
    if (!disallowedTools.includes(tool)) {
      disallowedTools.push(tool);
    }
  }

  return { disallowedTools: disallowedTools.length > 0 ? disallowedTools : undefined };
}
