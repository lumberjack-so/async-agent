/**
 * Health Command
 * Agent 6 implementation: Checks Alfred server health status
 */

import { api } from '../lib/api-client.js';
import { formatters } from '../lib/formatters.js';

export async function healthCommand(options: { json?: boolean }) {
  try {
    const health = await api.health();

    if (options.json) {
      console.log(JSON.stringify(health, null, 2));
    } else {
      console.log(formatters.formatHealthStatus(health));
    }
  } catch (error) {
    console.error(formatters.formatError(error as Error));
    process.exit(1);
  }
}
