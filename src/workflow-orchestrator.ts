/**
 * Workflow Orchestrator
 *
 * Orchestrates multi-step workflow execution with session forking.
 * Each step builds on the previous session's context.
 */

import fs from 'fs/promises';
import { executeWorkflowAgent } from './workflow-agent.js';
import { AgentResponse, Workflow, McpConnections, WorkflowAgentResponse, ExecutionStepMetadata } from './types.js';
import { sendStepUpdate, sendStreamUpdate } from './routes/stream.js';

/**
 * Orchestrate multi-step workflow execution
 *
 * NOTE: MCP connections are now resolved per-step from the database,
 * not passed in from the HTTP request level.
 *
 * @param workflow - Complete workflow with all steps
 * @param userPrompt - Original user prompt
 * @param requestId - Unique request identifier
 * @param systemPrompt - Optional system prompt override
 * @returns Combined agent response from all steps
 */
export async function executeWorkflowOrchestrator(
  workflow: Workflow,
  userPrompt: string,
  requestId: string,
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

    // Send conversational intro
    sendStreamUpdate(requestId, {
      type: 'commentary',
      message: `Perfect! I'll use my **${workflow.name}** skill for this.`,
    });

    sendStreamUpdate(requestId, {
      type: 'commentary',
      message: `This workflow has ${sortedSteps.length} steps. Let me walk you through them...`,
    });

    // Send workflow metadata with all steps
    sendStreamUpdate(requestId, {
      type: 'workflow',
      workflow: {
        name: workflow.name,
        totalSteps: sortedSteps.length,
        steps: sortedSteps.map(s => ({
          id: s.id,
          title: s.prompt.substring(0, 100),
          status: 'pending',
          details: [],  // Initialize empty details array
        })),
      },
    });

    let sessionId: string | null = null;
    let allTraces: any[] = [];

    // Execute each workflow step sequentially
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const isFirstStep = i === 0;
      const stepStartTime = Date.now();

      console.log(
        `[Orchestrator] >> Starting step ${step.id}/${sortedSteps.length}${isFirstStep ? ' (initial)' : ' (forking)'}`
      );
      console.log(
        `[Orchestrator]    Session ID: ${sessionId || 'NEW'}`
      );

      // Send conversational commentary
      if (i === 0) {
        sendStreamUpdate(requestId, {
          type: 'commentary',
          message: `Starting with Step ${step.id}...`,
        });
      } else {
        sendStreamUpdate(requestId, {
          type: 'commentary',
          message: `Moving on to Step ${step.id}...`,
        });
      }

      // Send SSE: Step started
      sendStepUpdate(requestId, {
        id: step.id,
        title: step.prompt.substring(0, 80) + (step.prompt.length > 80 ? '...' : ''),
        status: 'running',
      });

      // Execute step
      const stepResult: WorkflowAgentResponse = await executeWorkflowAgent({
        step,
        stepIndex: i,  // Pass step index for MCP config lookup
        skill: workflow,  // Pass full workflow for connection resolution
        userPrompt,
        requestId,
        workingDirectory,
        sessionId,
        forkSession: !isFirstStep,
        systemPrompt,
        // mcpConnections removed - resolved per-step now
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

      const stepDuration = Date.now() - stepStartTime;

      console.log(
        `[Orchestrator] << Completed step ${step.id}/${sortedSteps.length}\n`
      );

      // Send SSE: Step completed
      sendStepUpdate(requestId, {
        id: step.id,
        title: step.prompt.substring(0, 80) + (step.prompt.length > 80 ? '...' : ''),
        status: 'complete',
        duration: stepDuration,
      });

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

    const synthesisStepId = sortedSteps.length + 1;
    const synthesisStartTime = Date.now();

    const synthesisStep = {
      id: synthesisStepId,
      prompt: `Based on all the information you've gathered in the previous steps, provide a complete, natural response to the user's original request: "${userPrompt}"

Provide a clear, comprehensive answer that incorporates all the relevant data you've collected. Do not reference "steps" or "previous work" - just give the user what they asked for in a natural, helpful way.`,
      guidance: 'Synthesize all previous work into one complete response',
      allowedTools: [] as string[], // No tools needed - just synthesize
    };

    // Send SSE: Synthesis started
    sendStepUpdate(requestId, {
      id: synthesisStepId,
      title: 'Synthesizing final response...',
      status: 'running',
    });

    const synthesisResult: WorkflowAgentResponse = await executeWorkflowAgent({
      step: synthesisStep,
      stepIndex: sortedSteps.length,  // Synthesis step (no MCP config needed)
      skill: workflow,  // Pass full workflow for connection resolution
      userPrompt,
      requestId,
      workingDirectory,
      sessionId,
      forkSession: true,
      systemPrompt,
      // mcpConnections removed - resolved per-step now
    });

    const synthesisDuration = Date.now() - synthesisStartTime;

    console.log(`[Orchestrator]    Synthesis complete`);
    console.log(`[Orchestrator]    Final sessionId: ${synthesisResult.sessionId}`);

    // Send SSE: Synthesis completed
    sendStepUpdate(requestId, {
      id: synthesisStepId,
      title: 'Synthesizing final response...',
      status: 'complete',
      duration: synthesisDuration,
    });

    // Collect synthesis trace
    allTraces.push(...(synthesisResult.trace || []));

    console.log(`[Orchestrator] ========================================`);
    console.log(`[Orchestrator] ORCHESTRATION COMPLETE: ${workflow.name}`);
    console.log(
      `[Orchestrator] Total steps: ${sortedSteps.length} workflow + 1 synthesis = ${sortedSteps.length + 1}`
    );
    console.log(`[Orchestrator] ========================================\n`);

    // Extract step metadata from traces
    const stepMetadata: ExecutionStepMetadata[] = [];
    let currentStepId = 1;

    for (const message of allTraces) {
      if (message.type === 'result') {
        stepMetadata.push({
          id: currentStepId++,
          duration_ms: message.duration_ms || 0,
          total_cost_usd: message.total_cost_usd || 0,
          num_turns: message.num_turns || 0,
        });
      }
    }

    // Return synthesis response with metadata
    return {
      text: synthesisResult.text,
      workingDirectory: workingDirectory,
      trace: allTraces,
      steps: stepMetadata,
    };
  } catch (error) {
    console.error(`[Orchestrator] Workflow failed:`, error);

    if (error instanceof Error) {
      throw new Error(`Workflow orchestration failed: ${error.message}`);
    }

    throw new Error('Workflow orchestration failed');
  }
}
