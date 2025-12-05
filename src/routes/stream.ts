/**
 * SSE Streaming Routes
 * Server-Sent Events for real-time task updates
 */

import express, { Request, Response } from 'express';
import prisma from '../db/client.js';

const router = express.Router();

// Active SSE connections
const connections = new Map<string, Response>();

/**
 * SSE endpoint for streaming task updates
 * GET /stream/:executionId
 */
router.get('/:executionId', async (req: Request, res: Response) => {
  const { executionId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', executionId })}\n\n`);

  // Store connection
  connections.set(executionId, res);

  console.log(`[SSE] Client connected for execution ${executionId}`);

  // Check if execution exists and send history
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
    });

    if (execution) {
      // Send execution status
      const trace = execution.trace as any;
      if (trace?.steps) {
        for (const step of trace.steps) {
          res.write(`data: ${JSON.stringify({ type: 'step', step })}\n\n`);
        }
      }

      if (execution.status === 'completed' || execution.status === 'failed') {
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          status: execution.status,
          output: execution.output,
          metadata: {
            duration: execution.durationMs,
            tokenCount: execution.tokenCount,
            cost: execution.costUsd,
          },
        })}\n\n`);
      }
    }
  } catch (error) {
    console.error('[SSE] Error fetching execution:', error);
  }

  // Handle client disconnect
  req.on('close', () => {
    connections.delete(executionId);
    console.log(`[SSE] Client disconnected from execution ${executionId}`);
  });
});

/**
 * Send update to all connected clients for an execution
 */
export function sendStreamUpdate(executionId: string, data: any) {
  const connection = connections.get(executionId);
  if (connection) {
    try {
      connection.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('[SSE] Error sending update:', error);
      connections.delete(executionId);
    }
  }
}

/**
 * Helper to send step updates
 */
export function sendStepUpdate(executionId: string, step: {
  id: number;
  title: string;
  status: 'running' | 'complete' | 'error';
  duration?: number;
  error?: string;
}) {
  sendStreamUpdate(executionId, {
    type: 'step',
    step,
  });
}

/**
 * Helper to send completion
 */
export function sendCompletion(executionId: string, data: {
  status: 'completed' | 'failed';
  output?: any;
  metadata?: {
    duration?: number;
    tokenCount?: number;
    cost?: number;
  };
}) {
  sendStreamUpdate(executionId, {
    type: 'complete',
    ...data,
  });

  // Close connection after completion
  setTimeout(() => {
    const connection = connections.get(executionId);
    if (connection) {
      connection.end();
      connections.delete(executionId);
    }
  }, 100);
}

export default router;
