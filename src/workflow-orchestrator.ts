/**
 * Workflow Orchestrator
 *
 * Orchestrates multi-step workflow execution with session forking.
 * Each step builds on the previous session's context.
 */

import fs from 'fs/promises';
import { executeWorkflowAgent } from './workflow-agent.js';
import { AgentResponse, Workflow, McpConnections, WorkflowAgentResponse } from './types.js';

/**
 * Orchestrate multi-step workflow execution
 *
 * @param workflow - Complete workflow with all steps
 * @param userPrompt - Original user prompt
 * @param requestId - Unique request identifier
 * @param mcpConnections - MCP server connections to use
 * @param systemPrompt - Optional system prompt override
 * @returns Combined agent response from all steps
 */
export async function executeWorkflowOrchestrator(
  workflow: Workflow,
  userPrompt: string,
  requestId: string,
  mcpConnections: McpConnections,
  systemPrompt?: string
): Promise<AgentResponse> {
  const timestamp = Date.now();
  const workingDirectory = `/tmp/${requestId}-${timestamp}`;

  try {
    // Create shared working directory
    await fs.mkdir(workingDirectory, { recursive: true });
    console.log(`[Orchestrator] Created working directory: ${workingDirectory}`);

    // Sort steps by ID
    const sortedSteps = [...workflow.steps].sort((a, b) => a.id - b.id);

    console.log(`[Orchestrator] ========================================`);
    console.log(`[Orchestrator] Starting workflow: ${workflow.name}`);
    console.log(`[Orchestrator] Total steps: ${sortedSteps.length}`);
    console.log(`[Orchestrator] User prompt: "${userPrompt}"`);
    console.log(`[Orchestrator] ========================================\n`);

    let sessionId: string | null = null;
    let allTraces: any[] = [];

    // Execute each workflow step sequentially
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const isFirstStep = i === 0;

      console.log(
        `[Orchestrator] >> Starting step ${step.id}/${sortedSteps.length}${isFirstStep ? ' (initial)' : ' (forking)'}`
      );
      console.log(
        `[Orchestrator]    Session ID: ${sessionId || 'NEW'}`
      );

      // Execute step
      const stepResult: WorkflowAgentResponse = await executeWorkflowAgent({
        step,
        userPrompt,
        requestId,
        workingDirectory,
        mcpConnections,
        sessionId,
        forkSession: !isFirstStep,
        systemPrompt,
      });

      console.log(`[Orchestrator]    Received sessionId: ${stepResult.sessionId}`);

      // Store session ID for next step
      const previousSessionId = sessionId;
      sessionId = stepResult.sessionId;

      console.log(
        `[Orchestrator]    Session chain: ${previousSessionId || 'null'} -> ${sessionId}`
      );

      // Collect traces
      allTraces.push(...(stepResult.trace || []));

      console.log(
        `[Orchestrator] << Completed step ${step.id}/${sortedSteps.length}\n`
      );

      // Small delay between steps for stability
      if (i < sortedSteps.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`[Orchestrator] ========================================`);
    console.log(`[Orchestrator] All workflow steps completed: ${workflow.name}`);
    console.log(`[Orchestrator] Total steps executed: ${sortedSteps.length}`);
    console.log(`[Orchestrator] ========================================\n`);

    // FINAL SYNTHESIS STEP: Generate complete natural response
    console.log(`[Orchestrator] >> Starting FINAL SYNTHESIS STEP`);
    console.log(`[Orchestrator]    Forking from sessionId: ${sessionId}`);

    const synthesisStep = {
      id: sortedSteps.length + 1,
      prompt: `Based on all the information you've gathered in the previous steps, provide a complete, natural response to the user's original request: "${userPrompt}"

Provide a clear, comprehensive answer that incorporates all the relevant data you've collected. Do not reference "steps" or "previous work" - just give the user what they asked for in a natural, helpful way.`,
      guidance: 'Synthesize all previous work into one complete response',
      allowedTools: [] as string[], // No tools needed - just synthesize
    };

    const synthesisResult: WorkflowAgentResponse = await executeWorkflowAgent({
      step: synthesisStep,
      userPrompt,
      requestId,
      workingDirectory,
      mcpConnections,
      sessionId,
      forkSession: true,
      systemPrompt,
    });

    console.log(`[Orchestrator]    Synthesis complete`);
    console.log(`[Orchestrator]    Final sessionId: ${synthesisResult.sessionId}`);

    // Collect synthesis trace
    allTraces.push(...(synthesisResult.trace || []));

    console.log(`[Orchestrator] ========================================`);
    console.log(`[Orchestrator] ORCHESTRATION COMPLETE: ${workflow.name}`);
    console.log(
      `[Orchestrator] Total steps: ${sortedSteps.length} workflow + 1 synthesis = ${sortedSteps.length + 1}`
    );
    console.log(`[Orchestrator] ========================================\n`);

    // Return synthesis response
    return {
      text: synthesisResult.text,
      workingDirectory: workingDirectory,
      trace: allTraces,
    };
  } catch (error) {
    console.error(`[Orchestrator] Workflow failed:`, error);

    if (error instanceof Error) {
      throw new Error(`Workflow orchestration failed: ${error.message}`);
    }

    throw new Error('Workflow orchestration failed');
  }
}
