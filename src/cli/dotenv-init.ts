/**
 * Dotenv Initialization
 * MUST be imported first before any other modules
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get project root (two levels up from compiled file: dist/cli/dotenv-init.js -> dist/ -> project root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Load .env file from project root (not current working directory)
dotenv.config({ path: join(projectRoot, '.env') });

// Export empty object to satisfy TypeScript
export {};
