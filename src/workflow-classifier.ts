/**
 * Workflow Classifier
 *
 * Uses Claude to classify if a user prompt matches a known workflow.
 * Workflows are fetched from Prisma database.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAllSkills, getSkillById } from './database.js';
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
    // Fetch available skills (workflows) from database
    const skills = await getAllSkills();

    if (skills.length === 0) {
      console.log('[Classifier] No skills available in database');
      return {
        workflowId: null,
        workflowData: null,
        confidence: 'none',
      };
    }

    // Build classification prompt
    const workflowList = skills
      .map((s: any) => `- ${s.name}: ${s.description}`)
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

    // Find skill by exact name match
    const matchedSkill = skills.find(
      (s: any) => s.name.toLowerCase() === parsed.workflowName!.toLowerCase()
    );

    if (!matchedSkill) {
      console.warn(
        `[Classifier] Skill "${parsed.workflowName}" not found in database`
      );
      return {
        workflowId: null,
        workflowData: null,
        confidence: 'none',
        reasoning: 'Suggested skill not found in database',
      };
    }

    // Fetch full skill data with steps
    const workflowData = await getSkillById(matchedSkill.id);

    if (!workflowData) {
      console.warn(
        `[Classifier] Failed to fetch skill data for ${matchedSkill.id}`
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
      workflowData: workflowData as any,  // Type cast for Prisma result
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
