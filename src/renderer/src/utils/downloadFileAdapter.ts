import type { DownloadFile } from '../types/file';
import type { AppFile, FileStatus } from '../types/file';

/**
 * Converts a DownloadFile to an AppFile for compatibility with existing FileList components
 * Maps download-specific statuses and properties to the upload file format
 */
export function downloadFileToAppFile(downloadFile: DownloadFile): AppFile {
  // Map download status to upload status
  const mapStatus = (downloadStatus: DownloadFile['status']): FileStatus | undefined => {
    switch (downloadStatus) {
      case 'downloading':
        return 'uploading'; // Use 'uploading' status for active downloads
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'queued':
        return undefined; // No status = queued in FileTile
      default:
        return 'failed';
    }
  };

  return {
    id: String(downloadFile.file_id),
    name: downloadFile.name,
    size: downloadFile.size,
    type: downloadFile.type,
    path: downloadFile.filePath,
    source: 'download',
    status: mapStatus(downloadFile.status),
    progress: downloadFile.progress,
    error: downloadFile.error || undefined,
    lastModified: downloadFile.addedAt,
    lastModifiedDate: new Date(downloadFile.addedAt)
  } as AppFile;
}

/**
 * Converts an array of DownloadFiles to AppFiles
 */
export function downloadFilesToAppFiles(downloadFiles: DownloadFile[]): AppFile[] {
  return downloadFiles.map(downloadFileToAppFile);
} 