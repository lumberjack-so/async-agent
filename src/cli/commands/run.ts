/**
 * Run Command
 * Agent 6 implementation: Sends tasks to Alfred server
 */

import ora from 'ora';
import { api } from '../lib/api-client.js';
import { formatters } from '../lib/formatters.js';
import { validators } from '../lib/validators.js';
import { RunCommandOptions } from '../types.js';

export async function runCommand(prompt: string, options: RunCommandOptions) {
  try {
    // Validate prompt
    const validation = validators.validatePrompt(prompt);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Parse metadata if provided
    let metadata: Record<string, any> | undefined;
    if (options.metadata) {
      const metaValidation = validators.validateJson(options.metadata);
      if (!metaValidation.valid) {
        throw new Error(`Invalid metadata: ${metaValidation.error}`);
      }
      metadata = JSON.parse(options.metadata);
    }

    // Show spinner only if sync mode
    const spinner = options.async ? null : ora('Sending task to alfred...').start();

    // Call alfred API
    const response = await api.run({
      prompt,
      mode: options.mode,
      async: options.async,
      requestId: options.requestId,
      metadata,
    });

    if (spinner) spinner.stop();

    // Output response
    if (options.json) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(formatters.formatRunResponse(response, options.async || false));
    }
  } catch (error) {
    console.error(formatters.formatError(error as Error));
    process.exit(1);
  }
}
