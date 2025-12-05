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
 * Recursively walk directory and collect files created after a timestamp
 */
async function walkDirectoryByTime(
  dir: string,
  startTime: number,
  files: DetectedFile[],
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<void> {
  // Prevent infinite recursion
  if (currentDepth > maxDepth) {
    return;
  }

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files and certain system directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      try {
        if (entry.isDirectory()) {
          // Recursively walk subdirectories
          await walkDirectoryByTime(fullPath, startTime, files, maxDepth, currentDepth + 1);
        } else {
          // Check if file was created/modified after start time
          const stats = await fs.stat(fullPath);
          const fileModifiedTime = stats.mtimeMs;

          // Only include files modified after agent started
          if (fileModifiedTime >= startTime) {
            // Check size limit
            if (stats.size > MAX_FILE_SIZE_BYTES) {
              console.warn(
                `[Files] File ${fullPath} exceeds max size (${MAX_FILE_SIZE_MB}MB), skipping`
              );
              continue;
            }

            files.push({
              localPath: fullPath,
              filename: path.basename(fullPath),
              size: stats.size,
            });
          }
        }
      } catch (statError: any) {
        // Skip files we can't read (permissions, etc.)
        if (statError.code !== 'ENOENT' && statError.code !== 'EACCES') {
          console.warn(`[Files] Cannot stat ${fullPath}:`, statError.message);
        }
      }
    }
  } catch (readError: any) {
    // Skip directories we can't read
    if (readError.code !== 'ENOENT' && readError.code !== 'EACCES') {
      console.warn(`[Files] Cannot read directory ${dir}:`, readError.message);
    }
  }
}

/**
 * Detect all files created in /tmp during agent execution
 *
 * @param workingDirectory - Agent's working directory (for reference)
 * @param startTime - Timestamp when agent execution started (ms)
 */
export async function detectFiles(
  workingDirectory: string,
  startTime?: number
): Promise<DetectedFile[]> {
  try {
    const files: DetectedFile[] = [];
    const searchStartTime = startTime || Date.now() - 300000; // Default: last 5 minutes

    console.log(`[Files] Searching /tmp for files created after ${new Date(searchStartTime).toISOString()}`);

    // Search entire /tmp directory for recently created files
    await walkDirectoryByTime('/tmp', searchStartTime, files);

    console.log(`[Files] Detected ${files.length} files created during execution`);
    if (files.length > 0) {
      console.log(`[Files] File list: ${files.map(f => f.filename).join(', ')}`);
    }

    return files;
  } catch (error: any) {
    console.error(`[Files] Error detecting files:`, error);
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

    // Sanitize filename by replacing path separators with underscores
    // Example: "output/index.html" -> "output_index.html"
    const sanitizedFilename = file.filename.replace(/[\/\\]/g, '_');
    const destFilename = `${timestamp}-${sanitizedFilename}`;
    const destPath = path.join(storagePath, destFilename);

    // Copy file to persistent storage
    await fs.copyFile(file.localPath, destPath);

    // Generate URL (will be served by the app)
    const baseUrl = process.env.FILE_STORAGE_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const fileUrl = `${baseUrl}/files/${identifier}/${destFilename}`;

    console.log(`[Files] Stored: ${file.filename} -> ${fileUrl}`);

    return {
      name: file.filename, // Keep original path for user reference
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
