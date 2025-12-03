/**
 * Request validation schemas using Zod
 */

import { z } from 'zod';

export const webhookRequestSchema = z.object({
  /** User's prompt - required */
  prompt: z.string().min(1, 'Prompt is required').max(100000),

  /** Optional request identifier */
  requestId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'Request ID must be alphanumeric with _ or -')
    .max(100)
    .optional(),

  /** Optional system prompt override */
  systemPrompt: z.string().max(50000).optional(),

  /** Whether to run asynchronously */
  async: z.boolean().optional().default(false),

  /** Whether to search for matching workflows (default: true) */
  searchWorkflow: z.boolean().optional().default(true),

  /** Additional metadata */
  metadata: z.record(z.any()).optional(),
});

export type WebhookRequest = z.infer<typeof webhookRequestSchema>;
