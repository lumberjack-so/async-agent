#!/usr/bin/env node
/**
 * Post-install Script
 *
 * Runs after npm install to:
 * - Sync Composio toolkits to database (if enabled)
 * - Run database migrations (if needed)
 */

import '../src/cli/dotenv-init.js';
import { syncToolkitsIfNeeded } from '../src/services/composio/toolkit-sync.js';
import { isComposioAvailable } from '../src/services/composio/client.js';

async function postInstall() {
  console.log('[PostInstall] Running post-install tasks...');

  // Sync Composio toolkits if enabled
  if (isComposioAvailable()) {
    console.log('[PostInstall] Composio is enabled, syncing toolkits...');
    try {
      await syncToolkitsIfNeeded(true); // Force sync on install
      console.log('[PostInstall] ✓ Composio toolkits synced');
    } catch (error) {
      console.error(
        '[PostInstall] ⚠ Failed to sync Composio toolkits:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error('[PostInstall] You can manually sync later by running the server');
    }
  } else {
    console.log(
      '[PostInstall] Composio not enabled (COMPOSIO_API_KEY not set)'
    );
  }

  console.log('[PostInstall] ✓ Post-install tasks complete');
}

// Only run if this is the main script
if (import.meta.url === `file://${process.argv[1]}`) {
  postInstall().catch((error) => {
    console.error('[PostInstall] Fatal error:', error);
    process.exit(1);
  });
}
