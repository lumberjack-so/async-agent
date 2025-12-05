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
 * Recursively walk directory and collect all files
 */
async function walkDirectory(
  dir: string,
  baseDir: string,
  files: DetectedFile[]
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden files and directories
    if (entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively walk subdirectories
      await walkDirectory(fullPath, baseDir, files);
    } else {
      // Regular file - check size and add to list
      const stats = await fs.stat(fullPath);

      if (stats.size > MAX_FILE_SIZE_BYTES) {
        console.warn(
          `[Files] File ${entry.name} exceeds max size (${MAX_FILE_SIZE_MB}MB), skipping`
        );
        continue;
      }

      // Calculate relative path from base directory
      const relativePath = path.relative(baseDir, fullPath);

      files.push({
        localPath: fullPath,
        filename: relativePath, // Use relative path to preserve directory structure
        size: stats.size,
      });
    }
  }
}

/**
 * Detect all files in working directory (recursively)
 */
export async function detectFiles(workingDirectory: string): Promise<DetectedFile[]> {
  try {
    const files: DetectedFile[] = [];
    await walkDirectory(workingDirectory, workingDirectory, files);

    console.log(`[Files] Detected ${files.length} files in ${workingDirectory}`);
    if (files.length > 0) {
      console.log(`[Files] File list: ${files.map(f => f.filename).join(', ')}`);
    }

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
