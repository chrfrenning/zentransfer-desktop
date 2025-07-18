import { create } from 'zustand';
import type { DownloadStore, DownloadStats } from '../types/store';
import type { DownloadFile } from '../types/file';

const useDownloadStore = create<DownloadStore>((set, get) => ({
  // State
  files: [],
  stats: { queued: 0, downloading: 0, completed: 0, failed: 0 },
  isMonitoring: false,
  isLoading: false,
  lastSyncTime: 'Never',

  // Actions
  addFiles: (newFiles: ReadonlyArray<Partial<DownloadFile>>): void => {
    const filesToAdd: DownloadFile[] = newFiles.map(file => ({
      file_id: file.file_id ?? `${Date.now()}_${Math.random()}`,
      name: file.name ?? 'Unknown',
      size: file.size ?? 0,
      type: file.type ?? 'application/octet-stream',
      created: file.created,
      thumbnail_url: file.thumbnail_url,
      status: 'queued' as const,
      progress: 0,
      error: null,
      addedAt: Date.now(),
      updatedAt: Date.now(),
      ...file
    }));

    set((state) => {
      const updatedFiles = [...state.files, ...filesToAdd];
      return {
        files: updatedFiles,
        stats: calculateStats(updatedFiles)
      };
    });
  },

  updateFile: (fileId: string | number, updates: Partial<DownloadFile>): void => {
    set((state) => {
      const updatedFiles = state.files.map(file =>
        file.file_id === fileId
          ? { ...file, ...updates, updatedAt: Date.now() }
          : file
      );
      return {
        files: updatedFiles,
        stats: calculateStats(updatedFiles)
      };
    });
  },

  addOrUpdateFile: (fileId: string | number, fileData: Partial<DownloadFile>): void => {
    set((state) => {
      const existingFileIndex = state.files.findIndex(file => file.file_id === fileId);
      
      if (existingFileIndex >= 0) {
        // File exists, update it
        const updatedFiles = state.files.map(file =>
          file.file_id === fileId
            ? { ...file, ...fileData, updatedAt: Date.now() }
            : file
        );
        return {
          files: updatedFiles,
          stats: calculateStats(updatedFiles)
        };
      } else {
        // File doesn't exist, add it
        const newFile: DownloadFile = {
          file_id: fileId,
          name: fileData.name || 'Unknown',
          size: fileData.size || 0,
          type: fileData.type || 'application/octet-stream',
          status: fileData.status || 'queued',
          progress: fileData.progress || 0,
          addedAt: Date.now(),
          updatedAt: Date.now(),
          ...fileData
        };
        const updatedFiles = [...state.files, newFile];
        return {
          files: updatedFiles,
          stats: calculateStats(updatedFiles)
        };
      }
    });
  },

  updateFileStatus: (fileId: string | number, status: DownloadFile['status'], progress?: number, error?: string): void => {
    set((state) => {
      const updatedFiles = state.files.map(file =>
        file.file_id === fileId
          ? {
              ...file,
              status,
              progress: progress ?? file.progress,
              error: error ?? null,
              updatedAt: Date.now(),
              completedAt: (status === 'completed' || status === 'failed') ? Date.now() : undefined
            }
          : file
      );
      return {
        files: updatedFiles,
        stats: calculateStats(updatedFiles)
      };
    });
  },

  updateFileProgress: (fileId: string | number, progress: number, downloadedBytes?: number, totalBytes?: number): void => {
    set((state) => {
      const updatedFiles = state.files.map(file =>
        file.file_id === fileId
          ? {
              ...file,
              progress,
              downloadedBytes: downloadedBytes ?? file.downloadedBytes,
              totalBytes: totalBytes ?? file.totalBytes,
              updatedAt: Date.now()
            }
          : file
      );
      return {
        files: updatedFiles,
        stats: calculateStats(updatedFiles)
      };
    });
  },

  removeFile: (fileId: string | number): void => {
    set((state) => {
      const updatedFiles = state.files.filter(file => file.file_id !== fileId);
      return {
        files: updatedFiles,
        stats: calculateStats(updatedFiles)
      };
    });
  },

  clearFiles: (): void => {
    set({
      files: [],
      stats: { queued: 0, downloading: 0, completed: 0, failed: 0 }
    });
  },

  clearCompleted: (): void => {
    set((state) => {
      const updatedFiles = state.files.filter(file => file.status !== 'completed');
      return {
        files: updatedFiles,
        stats: calculateStats(updatedFiles)
      };
    });
  },

  setMonitoring: (isMonitoring: boolean): void => {
    set({ isMonitoring });
  },

  setLastSyncTime: (time: string): void => {
    set({ lastSyncTime: time });
  },

  // Selectors
  getQueuedFiles: (): DownloadFile[] => {
    return get().files.filter(file => file.status === 'queued');
  },

  getDownloadingFiles: (): DownloadFile[] => {
    return get().files.filter(file => file.status === 'downloading');
  },

  getCompletedFiles: (): DownloadFile[] => {
    return get().files.filter(file => file.status === 'completed');
  },

  getFailedFiles: (): DownloadFile[] => {
    return get().files.filter(file => file.status === 'failed');
  },

  getTotalFiles: (): number => {
    return get().files.length;
  },

  hasFiles: (): boolean => {
    return get().files.length > 0;
  },

  hasActiveDownloads: (): boolean => {
    return get().files.some(file => file.status === 'downloading');
  }
}));

// Helper function to calculate stats
function calculateStats(files: DownloadFile[]): DownloadStats {
  return files.reduce(
    (acc, file) => {
      acc[file.status]++;
      return acc;
    },
    { queued: 0, downloading: 0, completed: 0, failed: 0 }
  );
}

export { useDownloadStore }; 