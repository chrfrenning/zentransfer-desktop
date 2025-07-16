import { create } from 'zustand';
import type { UploadStore, UploadFile, UploadStats } from '../types/store';
import type { FileStatus } from '../types/file';

const useUploadStore = create<UploadStore>((set, get) => ({
  // State
  files: [],
  stats: { queued: 0, uploading: 0, completed: 0, failed: 0 },
  isLoading: false,
  isHydrated: true, // Set to true since we're not using persistence yet
  selectedService: 'zentransfer',

  // Actions
  addFiles: (newFiles: ReadonlyArray<Partial<UploadFile>>): void => {
    const filesToAdd: UploadFile[] = newFiles.map(file => ({
      id: file.id ?? `${Date.now()}_${Math.random()}`,
      name: file.name ?? 'Unknown',
      size: file.size ?? 0,
      type: file.type ?? 'application/octet-stream',
      path: file.path,
      source: file.source ?? 'unknown',
      status: 'queued' as const,
      progress: 0,
      error: null,
      addedAt: Date.now(),
      updatedAt: Date.now(),
      webkitRelativePath: file.webkitRelativePath,
      lastModified: file.lastModified,
      lastModifiedDate: file.lastModifiedDate,
      ...file
    }));

    set((state) => {
      // Check if any of the new files is named "fail.jpg"
      const hasFailTrigger = filesToAdd.some(file => file.name.toLowerCase() === 'fail.jpg');
      
      if (hasFailTrigger) {
        console.log('💥 FAIL TRIGGER DETECTED: fail.jpg added to queue - failing all files!');
        
        // Fail all existing files (queued, uploading) and mark new files as failed too
        const allFiles = [...state.files, ...filesToAdd];
        const failedFiles: UploadFile[] = allFiles.map(file => ({
          ...file,
          status: 'failed' as const,
          progress: 0,
          error: 'Failed due to fail.jpg trigger in queue',
          updatedAt: Date.now(),
          completedAt: Date.now()
        }));
        
        // Calculate stats for all failed files
        const failedStats: UploadStats = {
          queued: 0,
          uploading: 0,
          completed: 0,
          failed: failedFiles.length
        };
        
        console.log(`❌ Failed ${failedFiles.length} files due to fail.jpg trigger`);
        
        return {
          files: failedFiles,
          stats: failedStats
        };
      }
      
      // Normal file addition
      const updatedFiles = [...state.files, ...filesToAdd];
      const updatedStats: UploadStats = {
        ...state.stats,
        queued: state.stats.queued + filesToAdd.length
      };
      
      console.log('Added files to upload queue:', filesToAdd);
      
      return { 
        files: updatedFiles, 
        stats: updatedStats 
      };
    });
  },

  updateFileStatus: (
    fileId: string | number, 
    status: FileStatus | 'queued', 
    progress: number | null = null, 
    error: string | null = null
  ): void => {
    set((state) => {
      const oldFile = state.files.find(f => f.id === fileId);
      if (!oldFile) return state;

      const updatedFiles: UploadFile[] = state.files.map(file =>
        file.id === fileId 
          ? { 
              ...file, 
              status, 
              progress: progress !== null ? progress : file.progress,
              error,
              updatedAt: Date.now(),
              completedAt: (status === 'completed' || status === 'failed') ? Date.now() : file.completedAt
            } 
          : file
      );

      // Recalculate stats
      const newStats: UploadStats = updatedFiles.reduce<UploadStats>((acc, file) => {
        const currentStatus = file.status;
        return {
          ...acc,
          [currentStatus]: (acc[currentStatus as keyof UploadStats] || 0) + 1
        };
      }, { queued: 0, uploading: 0, completed: 0, failed: 0 });

      console.log(`File ${fileId} status changed: ${oldFile.status} -> ${status}`);
      
      return { 
        files: updatedFiles, 
        stats: newStats 
      };
    });
  },

  updateFileProgress: (fileId: string | number, progress: number): void => {
    set((state) => ({
      files: state.files.map(file =>
        file.id === fileId 
          ? { ...file, progress, updatedAt: Date.now() }
          : file
      )
    }));
  },

  clearFiles: (): void => {
    set({ 
      files: [], 
      stats: { queued: 0, uploading: 0, completed: 0, failed: 0 } 
    });
    console.log('Cleared all files from upload queue');
  },

  clearCompleted: (): void => {
    set((state) => {
      const remainingFiles = state.files.filter(f => f.status !== 'completed' && f.status !== 'failed');
      const newStats: UploadStats = remainingFiles.reduce<UploadStats>((acc, file) => {
        const currentStatus = file.status;
        return {
          ...acc,
          [currentStatus]: (acc[currentStatus as keyof UploadStats] || 0) + 1
        };
      }, { queued: 0, uploading: 0, completed: 0, failed: 0 });

      console.log('Cleared completed and failed files');
      
      return { 
        files: remainingFiles, 
        stats: newStats 
      };
    });
  },

  setSelectedService: (serviceType: string): void => {
    set({ selectedService: serviceType });
    console.log('Selected service changed to:', serviceType);
  },

  // Selectors (computed values)
  getQueuedFiles: (): UploadFile[] => get().files.filter(f => f.status === 'queued'),
  getUploadingFiles: (): UploadFile[] => get().files.filter(f => f.status === 'uploading'),
  getCompletedFiles: (): UploadFile[] => get().files.filter(f => f.status === 'completed'),
  getFailedFiles: (): UploadFile[] => get().files.filter(f => f.status === 'failed'),
  
  getTotalFiles: (): number => get().files.length,
  getNextQueuedFile: (): UploadFile | undefined => get().files.find(f => f.status === 'queued'),
  
  hasFiles: (): boolean => get().files.length > 0,
  hasActiveUploads: (): boolean => get().stats.uploading > 0,
  isCompleted: (): boolean => {
    const stats = get().stats;
    return stats.queued === 0 && stats.uploading === 0 && (stats.completed > 0 || stats.failed > 0);
  }
}));

export default useUploadStore; 