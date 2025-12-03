/**
 * Prompts Module
 *
 * Loads system and user prompts from files or environment variables.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPTS_DIR = path.join(__dirname, '../prompts');

/**
 * Load system prompt
 *
 * Priority:
 * 1. SYSTEM_PROMPT environment variable
 * 2. prompts/system.md file
 * 3. Default prompt
 */
export async function loadSystemPrompt(): Promise<string> {
  // Check environment variable first
  const envPrompt = process.env.SYSTEM_PROMPT;
  if (envPrompt) {
    console.log('[Prompts] Using system prompt from environment variable');
    return envPrompt.trim();
  }

  // Try to load from file
  try {
    const content = await fs.readFile(
      path.join(PROMPTS_DIR, 'system.md'),
      'utf-8'
    );
    console.log('[Prompts] Loaded system prompt from prompts/system.md');
    return content.trim();
  } catch (error) {
    // File doesn't exist - use default
    console.log('[Prompts] Using default system prompt');
    return getDefaultSystemPrompt();
  }
}

/**
 * Load user prompt prefix
 *
 * Priority:
 * 1. USER_PROMPT_PREFIX environment variable
 * 2. prompts/user.md file
 * 3. Empty string (no prefix)
 */
export async function loadUserPromptPrefix(): Promise<string | null> {
  // Check environment variable first
  const envPrompt = process.env.USER_PROMPT_PREFIX;
  if (envPrompt) {
    console.log('[Prompts] Using user prompt prefix from environment variable');
    return envPrompt.trim();
  }

  // Try to load from file
  try {
    const content = await fs.readFile(path.join(PROMPTS_DIR, 'user.md'), 'utf-8');
    console.log('[Prompts] Loaded user prompt prefix from prompts/user.md');
    return content.trim();
  } catch (error) {
    // File doesn't exist - no prefix
    return null;
  }
}

/**
 * Get default system prompt
 */
function getDefaultSystemPrompt(): string {
  return `You are a helpful AI assistant with access to various tools through MCP servers.

Use the available tools to help answer the user's questions and complete their requests.
Be concise and clear in your responses.
If you create files, mention them in your response.`;
}
