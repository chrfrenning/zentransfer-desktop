import type { FileStatus } from './file';

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