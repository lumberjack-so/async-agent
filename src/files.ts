/**
 * File Operations Module
 *
 * Handles file detection and local storage.
 */

import fs from 'fs/promises';
import path from 'path';
import { FileMetadata } from './types.js';

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const STORAGE_ROOT = process.env.LOCAL_STORAGE_PATH || './storage/files';

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
 * Upload file to local storage
 */
export async function uploadFile(
  file: DetectedFile,
  requestId: string | null | undefined
): Promise<FileMetadata | null> {
  try {
    const timestamp = Date.now();
    const identifier = requestId || `req-${timestamp}`;
    const storagePath = path.join(STORAGE_ROOT, identifier);

    // Create directory if it doesn't exist
    await fs.mkdir(storagePath, { recursive: true });

    const destPath = path.join(storagePath, `${timestamp}-${file.filename}`);

    // Copy file to persistent storage
    await fs.copyFile(file.localPath, destPath);

    // Generate URL (will be served by the app)
    const baseUrl = process.env.FILE_STORAGE_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const fileUrl = `${baseUrl}/files/${identifier}/${timestamp}-${file.filename}`;

    console.log(`[Files] Stored: ${file.filename} -> ${fileUrl}`);

    return {
      name: file.filename,
      url: fileUrl,
    };
  } catch (error) {
    console.error(`[Files] Storage error:`, error);
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
