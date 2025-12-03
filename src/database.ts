/**
 * Database Operations Module
 *
 * Handles storage of agent results in Supabase.
 */

import { getSupabaseClient, isSupabaseConfigured } from './shared/supabase.js';
import { FileMetadata, ResultRecord, Workflow } from './types.js';

/**
 * Insert result record to database
 *
 * @param record - Result record to store
 */
export async function upsertResult(record: ResultRecord): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('[DB] Supabase not configured - skipping database insert');
    return;
  }

  try {
    console.log(`[DB] Inserting result for requestId: ${record.requestId}`);
    console.log(`[DB]   - Files count: ${record.files.length}`);
    console.log(`[DB]   - Text length: ${record.text.length} chars`);

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('results')
      .insert({
        request_id: record.requestId,
        text: record.text,
        files: record.files,
        metadata: record.metadata || {},
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error(`[DB] Error inserting result:`, error);
      throw new Error(`Database insert failed: ${error.message}`);
    }

    console.log(`[DB] Successfully inserted result for requestId: ${record.requestId}`);
  } catch (error: any) {
    console.error(`[DB] Unexpected error in upsertResult:`, error);
    throw error;
  }
}

/**
 * Get result record by requestId
 *
 * @param requestId - Request identifier
 * @returns Result record or null if not found
 */
export async function getResult(requestId: string): Promise<ResultRecord | null> {
  if (!isSupabaseConfigured()) {
    console.warn('[DB] Supabase not configured - cannot fetch result');
    return null;
  }

  try {
    console.log(`[DB] Fetching result for requestId: ${requestId}`);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`[DB] No result found for requestId: ${requestId}`);
        return null;
      }
      console.error(`[DB] Error fetching result:`, error);
      throw error;
    }

    console.log(`[DB] Found result for requestId: ${requestId}`);

    return {
      text: data.text,
      requestId: data.request_id,
      files: data.files || [],
      metadata: data.metadata,
    };
  } catch (error: any) {
    console.error(`[DB] Unexpected error in getResult:`, error);
    throw error;
  }
}

/**
 * Health check - verify database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn('[DB] Supabase not configured - health check skipped');
    return true; // Return true so server starts without DB
  }

  try {
    console.log('[DB] Running health check...');

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('results').select('request_id').limit(1);

    if (error) {
      console.error('[DB] Health check failed:', error);
      return false;
    }

    console.log('[DB] Health check passed');
    return true;
  } catch (error) {
    console.error('[DB] Health check exception:', error);
    return false;
  }
}

/**
 * Fetch all available workflows
 *
 * @returns Array of workflows (id, name, description only)
 */
export async function getAllWorkflows(): Promise<
  Pick<Workflow, 'id' | 'name' | 'description'>[]
> {
  if (!isSupabaseConfigured()) {
    console.warn('[DB] Supabase not configured - cannot fetch workflows');
    return [];
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('workflows')
      .select('id, name, description')
      .order('name');

    if (error) {
      console.error('[DB] Failed to fetch workflows:', error);
      return [];
    }

    console.log(`[DB] Fetched ${data?.length || 0} workflows`);
    return data || [];
  } catch (error) {
    console.error('[DB] Unexpected error fetching workflows:', error);
    return [];
  }
}

/**
 * Fetch workflow by ID with full steps
 *
 * @param id - Workflow ID
 * @returns Complete workflow with steps, or null if not found
 */
export async function getWorkflowById(id: string): Promise<Workflow | null> {
  if (!isSupabaseConfigured()) {
    console.warn('[DB] Supabase not configured - cannot fetch workflow');
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('[DB] Failed to fetch workflow:', error);
      return null;
    }

    console.log(`[DB] Fetched workflow: ${data.name}`);
    return data as Workflow;
  } catch (error) {
    console.error('[DB] Unexpected error fetching workflow:', error);
    return null;
  }
}
