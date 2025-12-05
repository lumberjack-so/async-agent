/**
 * Webhook Handler
 *
 * Processes incoming prompts through the agent pipeline:
 * Request → Validation → Agent Execution → File Processing → Response
 */

import { Request, Response } from 'express';
import { webhookRequestSchema } from './validation.js';
import { executeWithMode } from './agent-executor.js';
import {
  detectFiles,
  uploadAllFiles,
  cleanupWorkingDirectory,
} from './files.js';
import { AgentError, ValidationError } from './utils/errors.js';
import { logger, getCorrelationId } from './middleware/logging.js';
import { metrics } from './utils/monitoring.js';
import { loadSystemPrompt, loadUserPromptPrefix } from './prompts.js';
import { WebhookResponse, ExecutionMode } from './types.js';

/**
 * Format uploaded files as text to append to agent response
 */
function formatFilesForResponse(files: any[]): string {
  if (files.length === 0) return '';

  const fileList = files
    .map((file, index) => {
      return `${index + 1}. ${file.name}\n   URL: ${file.url}`;
    })
    .join('\n');

  return `\n\n--- Files Generated ---\n${fileList}`;
}

/**
 * Main webhook handler
 */
export async function webhookHandler(req: Request, res: Response) {
  const startTime = Date.now();
  const correlationId = getCorrelationId(req);

  try {
    // Step 1: Validate request
    logger.info(correlationId, 'webhook', 'Validating request');
    const validation = webhookRequestSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ValidationError(
        'Invalid request body',
        new Error(JSON.stringify(validation.error.errors))
      );
    }

    const {
      prompt,
      requestId: providedRequestId,
      systemPrompt: requestSystemPrompt,
      async: isAsync,
      mode,
      metadata,
    } = validation.data;

    // Generate request ID if not provided
    const requestId = providedRequestId || `req-${Date.now()}`;

    // If async=true, respond immediately and continue in background
    if (isAsync) {
      logger.info(
        correlationId,
        'webhook',
        'Async mode enabled - responding immediately'
      );
      res.status(202).json({ status: 'processing', requestId });

      // Continue execution in background
      processWebhookAsync(
        req,
        prompt,
        requestId,
        requestSystemPrompt,
        mode,
        metadata,
        correlationId,
        startTime
      ).catch((error) => {
        logger.error(correlationId, 'webhook-async', 'Background execution failed', {
          error: error.message,
          name: error.name,
        });
        metrics.recordRequest(false, Date.now() - startTime);
        metrics.recordError(error.name || 'UnknownError');
      });

      return;
    }

    // Synchronous mode - execute and wait for completion
    logger.info(correlationId, 'webhook', `Processing request: ${requestId}`);

    const response = await processWebhook(
      req,
      prompt,
      requestId,
      requestSystemPrompt,
      mode,
      metadata,
      correlationId,
      startTime
    );

    res.json(response);
  } catch (error: any) {
    logger.error(correlationId, 'webhook', 'Request failed', {
      error: error.message,
      name: error.name,
    });

    metrics.recordRequest(false, Date.now() - startTime);
    metrics.recordError(error.name || 'UnknownError');

    throw error;
  }
}

/**
 * Process webhook request - returns response object
 */
async function processWebhook(
  req: Request,
  prompt: string,
  requestId: string,
  requestSystemPrompt: string | undefined,
  mode: ExecutionMode,
  metadata: Record<string, any> | undefined,
  correlationId: string,
  startTime: number
): Promise<WebhookResponse> {
  let workingDirectory: string | null = null;

  try {
    // Get MCP connections from request (set by connections middleware)
    const mcpConnections = req.mcpConnections || {};

    if (Object.keys(mcpConnections).length === 0) {
      logger.warn(
        correlationId,
        'webhook',
        'No MCP connections available - agent will have no tools'
      );
    } else {
      logger.info(
        correlationId,
        'webhook',
        `Using MCP connections: ${Object.keys(mcpConnections).join(', ')}`
      );
    }

    // Load prompts
    const systemPrompt = requestSystemPrompt || (await loadSystemPrompt());
    const userPromptPrefix = await loadUserPromptPrefix();

    // Execute agent with specified mode (classifier, orchestrator, or default)
    logger.info(correlationId, 'agent', `Starting execution with mode: ${mode}`);

    let agentResponse: string;
    let conversationTrace: any[] | undefined;
    let classification: any = undefined;
    let workflow: any = undefined;

    try {
      const result = await executeWithMode({
        mode: mode,
        prompt,
        requestId,
        mcpConnections,
        systemPrompt,
        userPromptPrefix: userPromptPrefix || undefined,
        correlationId,
      });

      agentResponse = result.text;
      workingDirectory = result.workingDirectory;
      conversationTrace = result.trace;
      classification = result.classification;
      workflow = result.workflow;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(
        correlationId,
        'agent',
        `Agent execution completed (duration: ${duration}s)`
      );
    } catch (error: any) {
      if (error.message?.includes('timeout')) {
        throw new AgentError('Agent execution timeout', error);
      }
      throw new AgentError('Agent execution failed', error);
    }

    // Process files
    logger.info(correlationId, 'files', 'Processing generated files');
    let uploadedFiles: any[] = [];

    try {
      if (workingDirectory) {
        const detectedFiles = await detectFiles(workingDirectory, startTime);

        if (detectedFiles.length > 0) {
          logger.info(
            correlationId,
            'files',
            `Detected ${detectedFiles.length} files`
          );
          metrics.recordFileGenerated();

          uploadedFiles = await uploadAllFiles(detectedFiles, requestId);

          if (uploadedFiles.length > 0) {
            logger.info(
              correlationId,
              'files',
              `Successfully uploaded ${uploadedFiles.length}/${detectedFiles.length} files`
            );
            uploadedFiles.forEach(() => metrics.recordFileUploaded());
          }
        } else {
          logger.info(correlationId, 'files', 'No files detected');
        }
      }
    } catch (error: any) {
      // File processing is non-fatal
      logger.error(correlationId, 'files', 'File processing error (non-fatal)', {
        error: error.message,
      });
      metrics.recordError('StorageError');
    }

    // Append file information to response text
    if (uploadedFiles.length > 0) {
      agentResponse += formatFilesForResponse(uploadedFiles);
      logger.info(
        correlationId,
        'files',
        `Appended ${uploadedFiles.length} file(s) to response text`
      );
    }

    // Note: Result storage removed - using Prisma for skills/executions only
    // Files are stored locally and traces are returned in the response

    // Cleanup working directory
    if (workingDirectory) {
      cleanupWorkingDirectory(workingDirectory).catch((error) => {
        logger.warn(correlationId, 'cleanup', 'Cleanup warning (non-fatal)', {
          error: error.message,
        });
      });
    }

    // Build and send response
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      correlationId,
      'webhook',
      `Request completed successfully (duration: ${duration}s)`
    );

    metrics.recordRequest(true, Date.now() - startTime);

    // Build response with classification and workflow info if applicable
    const response: WebhookResponse = {
      response: agentResponse,
      files: uploadedFiles,
      requestId,
    };

    // Include classification result if present (classifier or orchestrator modes)
    if (classification) {
      response.classification = classification;
    }

    // Include workflow info if workflow was executed
    if (workflow) {
      response.workflowId = workflow.id;
      response.workflow = workflow;
    }

    return response;
  } catch (error: any) {
    logger.error(correlationId, 'webhook', 'Request failed', {
      error: error.message,
      name: error.name,
    });

    metrics.recordRequest(false, Date.now() - startTime);
    metrics.recordError(error.name || 'UnknownError');

    if (workingDirectory) {
      cleanupWorkingDirectory(workingDirectory).catch((cleanupErr) => {
        logger.warn(correlationId, 'cleanup', 'Cleanup error during error handling', {
          error: cleanupErr.message,
        });
      });
    }

    throw error;
  }
}

/**
 * Process webhook request asynchronously (fire and forget)
 */
async function processWebhookAsync(
  req: Request,
  prompt: string,
  requestId: string,
  requestSystemPrompt: string | undefined,
  mode: ExecutionMode,
  metadata: Record<string, any> | undefined,
  correlationId: string,
  startTime: number
): Promise<void> {
  try {
    await processWebhook(
      req,
      prompt,
      requestId,
      requestSystemPrompt,
      mode,
      metadata,
      correlationId,
      startTime
    );
  } catch (error: any) {
    logger.error(correlationId, 'webhook-async', 'Async processing failed', {
      error: error.message,
      name: error.name,
    });
    throw error;
  }
}
