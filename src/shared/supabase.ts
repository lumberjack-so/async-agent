/**
 * Shared Supabase Client Module
 *
 * Provides a single, lazily-initialized Supabase client for use across
 * database.ts and files.ts modules. This ensures consistent configuration
 * and prevents creating multiple client instances.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Lazy-initialized client
let supabaseClient: SupabaseClient | null = null;
let isConfigured = false;

/**
 * Check if Supabase is properly configured
 *
 * @returns true if SUPABASE_URL and SUPABASE_SERVICE_KEY are set
 */
export function isSupabaseConfigured(): boolean {
  if (isConfigured !== undefined) {
    return isConfigured;
  }

  isConfigured = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

  if (!isConfigured) {
    if (!SUPABASE_URL) {
      console.warn('[Supabase] SUPABASE_URL not set - database operations will be skipped');
    }
    if (!SUPABASE_SERVICE_KEY) {
      console.warn(
        '[Supabase] SUPABASE_SERVICE_KEY not set - database operations will be skipped'
      );
    }
  }

  return isConfigured;
}

/**
 * Get the shared Supabase client instance
 *
 * Creates the client on first access (lazy initialization).
 * If credentials are not configured, returns a placeholder client
 * that will fail gracefully on operations.
 *
 * @returns Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Create client even if not configured (for graceful degradation)
  supabaseClient = createClient(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_SERVICE_KEY || 'placeholder-key'
  );

  if (isSupabaseConfigured()) {
    console.log('[Supabase] Client initialized successfully');
  } else {
    console.warn('[Supabase] Client initialized with placeholder credentials');
  }

  return supabaseClient;
}

/**
 * Health check - verify Supabase connection and access
 *
 * Attempts to query the results table to verify database connectivity.
 * Returns true even if not configured (allows server to start without DB).
 *
 * @returns true if health check passes or if DB not configured, false on error
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Health check skipped - not configured');
    return true; // Return true so server starts without DB
  }

  try {
    console.log('[Supabase] Running health check...');
    const client = getSupabaseClient();

    const { error } = await client.from('results').select('request_id').limit(1);

    if (error) {
      console.error('[Supabase] Health check failed:', error);
      return false;
    }

    console.log('[Supabase] Health check passed');
    return true;
  } catch (error) {
    console.error('[Supabase] Health check exception:', error);
    return false;
  }
}
