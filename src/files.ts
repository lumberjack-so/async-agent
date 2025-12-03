/**
 * File Operations Module
 *
 * Handles file detection and upload to Supabase Storage.
 */

import fs from 'fs/promises';
import path from 'path';
import { FileMetadata } from './types.js';
import { getSupabaseClient, isSupabaseConfigured } from './shared/supabase.js';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'agent-files';
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface DetectedFile {
  localPath: string;
  filename: string;
  size: number;
}

/**
 * Detect all files in working directory
 */
export async function detectFiles(workingDirectory: string): Promise<DetectedFile[]> {
  try {
    const entries = await fs.readdir(workingDirectory, { withFileTypes: true });
    const files: DetectedFile[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() || entry.name.startsWith('.')) {
        continue;
      }

      const localPath = path.join(workingDirectory, entry.name);
      const stats = await fs.stat(localPath);

      if (stats.size > MAX_FILE_SIZE_BYTES) {
        console.warn(
          `[Files] File ${entry.name} exceeds max size (${MAX_FILE_SIZE_MB}MB), skipping`
        );
        continue;
      }

      files.push({
        localPath,
        filename: entry.name,
        size: stats.size,
      });
    }

    console.log(`[Files] Detected ${files.length} files in ${workingDirectory}`);
    return files;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`[Files] Directory not found: ${workingDirectory}`);
    } else {
      console.error(`[Files] Error detecting files:`, error);
    }
    return [];
  }
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  file: DetectedFile,
  requestId: string | null | undefined
): Promise<FileMetadata | null> {
  if (!isSupabaseConfigured()) {
    console.warn('[Files] Supabase not configured - skipping upload');
    return null;
  }

  try {
    const timestamp = Date.now();
    const identifier = requestId || `req-${timestamp}`;
    const storagePath = `${identifier}/${timestamp}-${file.filename}`;

    const fileBuffer = await fs.readFile(file.localPath);

    console.log(`[Files] Uploading ${file.filename} to ${STORAGE_BUCKET}/${storagePath}`);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      console.error(`[Files] Upload error for ${file.filename}:`, error);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    console.log(`[Files] Uploaded ${file.filename} -> ${publicUrl}`);

    return {
      name: file.filename,
      url: publicUrl,
    };
  } catch (error) {
    console.error(`[Files] Unexpected upload error:`, error);
    return null;
  }
}

/**
 * Upload all detected files
 */
export async function uploadAllFiles(
  files: DetectedFile[],
  requestId: string | null | undefined
): Promise<FileMetadata[]> {
  // Upload files in parallel using Promise.allSettled
  const uploadResults = await Promise.allSettled(
    files.map(file => uploadFile(file, requestId))
  );

  // Collect successful uploads and log failures
  const uploaded: FileMetadata[] = [];
  uploadResults.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      uploaded.push(result.value);
    } else if (result.status === 'rejected') {
      console.error(`[Files] Upload failed for ${files[index].filename}:`, result.reason);
    }
  });

  console.log(`[Files] Successfully uploaded ${uploaded.length}/${files.length} files`);
  return uploaded;
}

/**
 * Clean up working directory
 */
export async function cleanupWorkingDirectory(workingDirectory: string): Promise<void> {
  try {
    await fs.rm(workingDirectory, { recursive: true, force: true });
    console.log(`[Files] Cleaned up ${workingDirectory}`);
  } catch (error) {
    console.error(`[Files] Cleanup error (non-fatal):`, error);
  }
}

/**
 * Clean up temp directory by requestId
 */
export async function cleanupTempDirectory(requestId: string): Promise<void> {
  try {
    const tmpDir = '/tmp';
    const entries = await fs.readdir(tmpDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(`${requestId}-`)) {
        const dirPath = path.join(tmpDir, entry.name);
        await cleanupWorkingDirectory(dirPath);
      }
    }
  } catch (error) {
    console.error(`[Files] Cleanup temp directory error (non-fatal):`, error);
  }
}
