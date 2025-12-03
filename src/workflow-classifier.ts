/**
 * Workflow Classifier
 *
 * Uses Claude to classify if a user prompt matches a known workflow.
 * Workflows are fetched from Supabase.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAllWorkflows, getWorkflowById } from './database.js';
import { ClassificationResult, Workflow } from './types.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CLASSIFIER_MODEL =
  process.env.CLASSIFIER_MODEL || 'claude-haiku-4-5-20251001';

/**
 * Classify user prompt to determine if it matches a workflow
 *
 * @param userPrompt - The user's input prompt
 * @returns Classification result with matched workflow (if any)
 */
export async function classifyWorkflow(
  userPrompt: string
): Promise<ClassificationResult> {
  try {
    // Fetch available workflows from database
    const workflows = await getAllWorkflows();

    if (workflows.length === 0) {
      console.log('[Classifier] No workflows available in database');
      return {
        workflowId: null,
        workflowData: null,
        confidence: 'none',
      };
    }

    // Build classification prompt
    const workflowList = workflows
      .map((w) => `- ${w.name}: ${w.description}`)
      .join('\n');

    const classificationPrompt = `You are a workflow classifier.

Given the user's request, determine if it matches one of the available pre-built workflows.

AVAILABLE WORKFLOWS:
${workflowList}

USER REQUEST:
"${userPrompt}"

INSTRUCTIONS:
1. Analyze the user's request
2. Determine if it clearly matches one of the available workflows
3. Respond with JSON ONLY in this exact format:

{
  "match": true/false,
  "workflowName": "exact_workflow_name" or null,
  "confidence": "high/medium/low/none",
  "reasoning": "brief explanation"
}

RULES:
- Only match if you're confident the workflow fits the request
- Use exact workflow names from the list above
- If uncertain or request is custom/ad-hoc, return match: false
- Confidence "high" = clearly matches, "medium" = likely matches, "low" = might match, "none" = no match`;

    console.log('[Classifier] Sending classification request to Claude');

    const response = await anthropic.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: classificationPrompt,
        },
      ],
    });

    // Extract text from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    const parsed = parseClassificationResponse(content.text);

    if (!parsed.match || !parsed.workflowName) {
      console.log('[Classifier] No workflow match found');
      return {
        workflowId: null,
        workflowData: null,
        confidence: parsed.confidence || 'none',
        reasoning: parsed.reasoning,
      };
    }

    // Find workflow by exact name match
    const matchedWorkflow = workflows.find(
      (w) => w.name.toLowerCase() === parsed.workflowName!.toLowerCase()
    );

    if (!matchedWorkflow) {
      console.warn(
        `[Classifier] Workflow "${parsed.workflowName}" not found in database`
      );
      return {
        workflowId: null,
        workflowData: null,
        confidence: 'none',
        reasoning: 'Suggested workflow not found in database',
      };
    }

    // Fetch full workflow data with steps
    const workflowData = await getWorkflowById(matchedWorkflow.id);

    if (!workflowData) {
      console.warn(
        `[Classifier] Failed to fetch workflow data for ${matchedWorkflow.id}`
      );
      return {
        workflowId: null,
        workflowData: null,
        confidence: 'none',
      };
    }

    console.log(
      `[Classifier] Matched workflow: ${workflowData.name} (confidence: ${parsed.confidence})`
    );

    return {
      workflowId: workflowData.id,
      workflowData,
      confidence: parsed.confidence || 'medium',
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('[Classifier] Classification failed:', error);
    // On error, fall back to one-off agent
    return {
      workflowId: null,
      workflowData: null,
      confidence: 'none',
    };
  }
}

/**
 * Parse classification response from Claude
 */
function parseClassificationResponse(text: string): {
  match: boolean;
  workflowName: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reasoning?: string;
} {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      match: false,
      workflowName: null,
      confidence: 'none',
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      match: parsed.match ?? false,
      workflowName: parsed.workflowName ?? null,
      confidence: parsed.confidence ?? 'none',
      reasoning: parsed.reasoning,
    };
  } catch {
    return {
      match: false,
      workflowName: null,
      confidence: 'none',
    };
  }
}
