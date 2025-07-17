import type { FileStatus } from './file';
import type { CloudServiceType } from './cloud';

// Import file representation (discovered files from source)
export interface ImportFile {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly path: string;
  readonly relativePath: string; // Path relative to import source
  readonly lastModified: number;
  readonly source: 'local' | 'cloud';
  status: ImportFileStatus;
  progress: number; // 0-100
  error?: string | null;
  readonly discoveredAt: number;
  updatedAt: number;
  completedAt?: number | undefined;
  destinations: ImportDestination[];
}

export type ImportFileStatus = 
  | 'discovered'  // File found but not yet processed
  | 'queued'      // Ready to be processed
  | 'processing'  // Currently being processed
  | 'completed'   // Successfully processed
  | 'failed'      // Failed to process
  | 'skipped';    // Skipped (duplicate/excluded)

export interface ImportDestination {
  readonly type: 'local' | 'backup' | 'cloud';
  readonly path?: string;
  readonly cloudService?: CloudServiceType;
  readonly enabled: boolean;
  status: ImportFileStatus;
  error?: string | null;
}

// Import configuration/settings
export interface ImportSettings {
  // Source configuration
  readonly sourcePath: string;
  readonly includeSubdirectories: boolean;
  
  // Filtering configuration
  readonly importTypeFilter: 'allFiles' | 'imageFiles' | 'jpegOnly' | 'rawOnly';
  readonly importTimeFilter: 'allTime' | 'today' | 'yesterday' | 'highWaterMark';
  
  // Destination configuration
  readonly destinationPath: string;
  readonly organizeIntoFolders: boolean;
  readonly folderOrganizationType: 'date' | 'custom';
  readonly customFolderName?: string;
  readonly dateFormat: string;
  
  // Backup configuration
  readonly backupEnabled: boolean;
  readonly backupPath?: string;
  
  // Cloud upload configuration
  readonly enableCloudUpload: boolean;
  readonly uploadToZenTransfer: boolean;
  readonly uploadToAwsS3: boolean;
  readonly uploadToAzure: boolean;
  readonly uploadToGcp: boolean;
  readonly uploadToMinio: boolean;
  
  // Processing preferences
  readonly skipDuplicates: boolean;
  readonly skipExisting: boolean;
  readonly createPreviews: boolean;
  readonly extractMetadata: boolean;
}

// Import statistics
export interface ImportStats {
  readonly discovered: number;   // Files discovered from source
  readonly queued: number;      // Files waiting to be processed
  readonly processing: number;  // Files currently being processed
  readonly completed: number;   // Files successfully processed
  readonly failed: number;      // Files that failed to process
  readonly skipped: number;     // Files that were skipped
  readonly totalSize: number;   // Total size of all files in bytes
  readonly processedSize: number; // Size of processed files in bytes
}

// Import progress data for current operation
export interface ImportProgressData {
  readonly currentFile?: ImportFile | undefined;
  readonly currentDestination?: string | undefined;
  readonly overallProgress: number; // 0-100
  readonly currentFileProgress: number; // 0-100
  readonly estimatedTimeRemaining?: number | undefined;
  readonly transferSpeed?: number | undefined; // bytes per second
}

// Import mode states
export type ImportMode = 'setup' | 'processing' | 'done';

// Store state interface
export interface ImportStoreState {
  // Core state
  files: ImportFile[];
  stats: ImportStats;
  settings: Partial<ImportSettings>;
  mode: ImportMode;
  isLoading: boolean;
  
  // Progress tracking
  progressData: ImportProgressData;
  
  // Error handling
  lastError?: string | null;
  
  // Discovery state
  isDiscovering: boolean;
  discoveryProgress: number;
}

// Store actions interface
export interface ImportStoreActions {
  // File management
  setFiles: (files: ImportFile[]) => void;
  addFiles: (files: Partial<ImportFile>[]) => void;
  updateFileStatus: (fileId: string, status: ImportFileStatus, progress?: number, error?: string | null) => void;
  updateFileProgress: (fileId: string, progress: number) => void;
  clearFiles: () => void;
  
  // Settings management
  updateSettings: (settings: Partial<ImportSettings>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  
  // Import operations
  startDiscovery: () => Promise<void>;
  startImport: () => Promise<void>;
  cancelImport: () => Promise<void>;
  resetImport: () => void;
  
  // Mode management
  setMode: (mode: ImportMode) => void;
  
  // Progress updates
  updateProgress: (progressData: Partial<ImportProgressData>) => void;
  
  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Selectors
  getDiscoveredFiles: () => ImportFile[];
  getQueuedFiles: () => ImportFile[];
  getProcessingFiles: () => ImportFile[];
  getCompletedFiles: () => ImportFile[];
  getFailedFiles: () => ImportFile[];
  getSkippedFiles: () => ImportFile[];
  getTotalFiles: () => number;
  hasFiles: () => boolean;
  isCompleted: () => boolean;
  canStartImport: () => boolean;
}

// Combined store type
export type ImportStore = ImportStoreState & ImportStoreActions;

// File discovery result
export interface FileDiscoveryResult {
  readonly files: ImportFile[];
  readonly totalSize: number;
  readonly duration: number;
}

// Import completion result
export interface ImportCompletionResult {
  readonly success: boolean;
  readonly stats: ImportStats;
  readonly duration: number;
  readonly errors: string[];
} 