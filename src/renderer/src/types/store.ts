import type { FileStatus, DownloadFile } from './file';

export interface UploadFile {
  readonly id: string | number;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly path?: string | undefined;
  readonly source: string;
  status: FileStatus | 'queued';
  progress: number;
  error?: string | null | undefined;
  readonly addedAt: number;
  updatedAt: number;
  completedAt?: number | undefined;
  readonly webkitRelativePath?: string | undefined;
  readonly lastModified?: number | undefined;
  readonly lastModifiedDate?: Date | undefined;
}

export interface UploadStats {
  readonly queued: number;
  readonly uploading: number;
  readonly completed: number;
  readonly failed: number;
}

export interface UploadStoreState {
  // State
  files: UploadFile[];
  stats: UploadStats;
  isLoading: boolean;
  isHydrated: boolean;
  selectedService: string;
}

export interface UploadStoreActions {
  // Actions
  addFiles: (newFiles: ReadonlyArray<Partial<UploadFile>>) => void;
  updateFileStatus: (fileId: string | number, status: FileStatus | 'queued', progress?: number | null, error?: string | null) => void;
  updateFileProgress: (fileId: string | number, progress: number) => void;
  clearFiles: () => void;
  clearCompleted: () => void;
  setSelectedService: (serviceType: string) => void;
  
  // Selectors
  getQueuedFiles: () => UploadFile[];
  getUploadingFiles: () => UploadFile[];
  getCompletedFiles: () => UploadFile[];
  getFailedFiles: () => UploadFile[];
  getTotalFiles: () => number;
  getNextQueuedFile: () => UploadFile | undefined;
  hasFiles: () => boolean;
  hasActiveUploads: () => boolean;
  isCompleted: () => boolean;
}

export type UploadStore = UploadStoreState & UploadStoreActions; 

export interface DownloadStats {
  readonly queued: number;
  readonly downloading: number;
  readonly completed: number;
  readonly failed: number;
}

export interface DownloadStoreState {
  files: DownloadFile[];
  stats: DownloadStats;
  isMonitoring: boolean;
  isLoading: boolean;
  lastSyncTime: string;
}

export interface DownloadStoreActions {
  // File management
  addFiles: (newFiles: ReadonlyArray<Partial<DownloadFile>>) => void;
  updateFile: (fileId: string | number, updates: Partial<DownloadFile>) => void;
  updateFileStatus: (fileId: string | number, status: DownloadFile['status'], progress?: number, error?: string) => void;
  updateFileProgress: (fileId: string | number, progress: number, downloadedBytes?: number, totalBytes?: number) => void;
  removeFile: (fileId: string | number) => void;
  clearFiles: () => void;
  clearCompleted: () => void;
  
  // Monitoring state
  setMonitoring: (isMonitoring: boolean) => void;
  setLastSyncTime: (time: string) => void;
  
  // Selectors
  getQueuedFiles: () => DownloadFile[];
  getDownloadingFiles: () => DownloadFile[];
  getCompletedFiles: () => DownloadFile[];
  getFailedFiles: () => DownloadFile[];
  getTotalFiles: () => number;
  hasFiles: () => boolean;
  hasActiveDownloads: () => boolean;
}

export type DownloadStore = DownloadStoreState & DownloadStoreActions; 