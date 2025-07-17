import type { CloudServiceType, EnabledService, CloudSettingsResult, UpdateSettingsResult, CloudService, AwsRegion } from '../types/cloud';
import type { AppFile, FileStatus } from '../types/file';

// ============================================================================
// Base Interfaces
// ============================================================================

export interface LogMeta {
  readonly [key: string]: unknown;
}

export interface FileDialogOptions {
  readonly defaultPath?: string;
  readonly buttonLabel?: string;
  readonly title?: string;
  readonly filters?: ReadonlyArray<{ 
    readonly name: string; 
    readonly extensions: ReadonlyArray<string> 
  }>;
  readonly properties?: ReadonlyArray<
    'openFile' | 'openDirectory' | 'multiSelections' | 
    'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 
    'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'
  >;
}

export interface FileDialogResult {
  readonly canceled: boolean;
  readonly filePaths: ReadonlyArray<string>;
}

export interface DirectoryDialogResult {
  readonly canceled: boolean;
  readonly filePaths: ReadonlyArray<string>;
}

export interface LogInfo {
  readonly size?: number;
  readonly path?: string;
  readonly exists?: boolean;
}

export interface ShowLogsFolderResult {
  readonly success: boolean;
  readonly error?: string;
}

export interface VersionCheckResult {
  readonly success: boolean;
  readonly upToDate: boolean;
  readonly currentVersion: string;
  readonly latestVersion?: string;
  readonly error?: string;
}

export interface UrlsConfig {
  readonly serverUrl: string;
  readonly [key: string]: unknown;
}

// ============================================================================
// Authentication Interfaces
// ============================================================================

export interface LoginInitResult {
  readonly success: boolean;
  readonly sessionId?: string;
  readonly error?: string;
}

export interface LoginFinalizeResult {
  readonly success: boolean;
  readonly token?: string;
  readonly email?: string;
  readonly error?: string;
}

export interface ValidationResult {
  readonly success: boolean;
  readonly valid: boolean;
  readonly error?: string;
}

// ============================================================================
// Cloud Services Interfaces (imported from cloud.ts)
// ============================================================================

// ============================================================================
// Upload Interfaces
// ============================================================================

export interface UploadFile {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly path: string;
  readonly source: string;
  readonly lastModified: number;
}

export interface UploadJob {
  readonly id: string;
  readonly files: ReadonlyArray<UploadFile>;
  readonly status: 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  readonly progress: number;
  readonly error?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt?: number;
}

export interface UploadProgressData {
  readonly jobId: string;
  readonly fileId?: string;
  readonly progress: number;
  readonly status: FileStatus;
  readonly error?: string;
  readonly bytesTransferred?: number;
  readonly totalBytes?: number;
  readonly speed?: number;
  readonly eta?: number;
}

export interface UploadUpdateData {
  readonly type: 'job_added' | 'job_updated' | 'job_completed' | 'job_failed' | 'job_cancelled' | 'queue_cleared';
  readonly job?: UploadJob;
  readonly stats?: UploadStats;
}

export interface UploadStats {
  readonly queued: number;
  readonly uploading: number;
  readonly completed: number;
  readonly failed: number;
  readonly totalFiles: number;
  readonly totalSize: number;
  readonly uploadedSize: number;
}

// ============================================================================
// Import Interfaces
// ============================================================================

export interface ImportSource {
  readonly type: 'local' | 'cloud';
  readonly path?: string;
  readonly cloudService?: CloudServiceType;
  readonly settings?: Record<string, unknown>;
}

export interface ImportStats {
  readonly totalFiles: number;
  readonly processedFiles: number;
  readonly skippedFiles: number;
  readonly errorFiles: number;
  readonly currentFile?: string;
  readonly progress: number;
}

export interface ImportUpdateData {
  readonly type: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  readonly stats?: ImportStats;
  readonly error?: string;
  readonly message?: string;
}

export interface ImportCompleteData {
  readonly success: boolean;
  readonly stats: ImportStats;
  readonly duration: number;
  readonly errors?: ReadonlyArray<string>;
}

// ============================================================================
// Download Interfaces
// ============================================================================

export interface DownloadStats {
  readonly totalFiles: number;
  readonly downloadedFiles: number;
  readonly failedFiles: number;
  readonly skippedFiles: number;
  readonly currentFile?: string;
  readonly progress: number;
  readonly isActive: boolean;
  readonly lastSyncTime?: number;
}

export interface DownloadUpdateData {
  readonly type: 'started' | 'progress' | 'completed' | 'failed' | 'stopped';
  readonly stats?: DownloadStats;
  readonly error?: string;
  readonly message?: string;
}

// ============================================================================
// Auto-Updater Interfaces
// ============================================================================

export type UpdateStatus = 
  | 'checking-for-update'
  | 'update-available' 
  | 'update-not-available'
  | 'update-downloaded'
  | 'download-progress'
  | 'error';

export interface UpdateProgressInfo {
  readonly bytesPerSecond: number;
  readonly percent: number;
  readonly transferred: number;
  readonly total: number;
}

export interface UpdateInfo {
  readonly version: string;
  readonly releaseDate: string;
  readonly releaseName?: string;
  readonly releaseNotes?: string;
}

export interface UpdateCheckResult {
  readonly available: boolean;
  readonly info?: UpdateInfo;
  readonly error?: string;
}

// ============================================================================
// Node.js Operations Interfaces
// ============================================================================

export interface HttpsGetOptions {
  readonly headers?: Record<string, string>;
  readonly timeout?: number;
}

export interface HttpsGetResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly statusCode?: number;
  readonly error?: string;
}

// ============================================================================
// Listener Cleanup Function Type
// ============================================================================

export type ListenerCleanup = () => void;

// ============================================================================
// Main API Interface
// ============================================================================

export interface ZenTransferAPI {
  readonly app: {
    getVersion(): Promise<string>;
    getIsDevelopmentMode(): Promise<boolean>;
    getServerUrl(): Promise<string>;
    doVersionCheck(): Promise<VersionCheckResult>;
    quit(): Promise<void>;
    log(level: string, message: string, meta?: LogMeta): void;
    showLogsFolder(): Promise<ShowLogsFolderResult>;
    getLogInfo(): Promise<LogInfo>;
  };

  readonly config: {
    get(section: string): Promise<unknown>;
    set(section: string, value: unknown): Promise<void>;
    getCloudSettings(serviceType: CloudServiceType): Promise<CloudSettingsResult>;
    updateCloudSettings(serviceType: CloudServiceType, settings: Record<string, unknown>): void;
    getUrls(): Promise<UrlsConfig>;
  };

  readonly auth: {
    hasValidToken(): Promise<boolean>;
    getToken(): Promise<string | null>;
    getEmail(): Promise<string | null>;
    initializeLogin(email: string): Promise<boolean>;
    finalizeLogin(otp: string): Promise<boolean>;
    validateConnection(): Promise<ValidationResult>;
    logout(): Promise<void>;
  };

  readonly clouds: {
    getServices(): Promise<ReadonlyArray<CloudService>>;
    getEnabledServices(): Promise<ReadonlyArray<EnabledService>>;
    getAwsRegions(): Promise<ReadonlyArray<AwsRegion>>;
  };

  readonly dialog: {
    showFileDialog(options: FileDialogOptions): Promise<FileDialogResult>;
    showDirectoryDialog(): Promise<DirectoryDialogResult>;
  };

  readonly upload: {
    addToQueue(files: ReadonlyArray<UploadFile>): Promise<string>;
    cancelJob(jobId: string): Promise<boolean>;
    cancelAll(): Promise<void>;
    getQueueStats(): Promise<UploadStats>;
    onProgress(callback: (data: UploadProgressData) => void): ListenerCleanup;
    onUpdate(callback: (data: UploadUpdateData) => void): ListenerCleanup;
  };

  readonly import: {
    start(source: ImportSource): Promise<boolean>;
    cancel(): Promise<void>;
    getQueueStats(): Promise<ImportStats>;
    onUpdate(callback: (data: ImportUpdateData) => void): ListenerCleanup;
    onComplete(callback: (data: ImportCompleteData) => void): ListenerCleanup;
  };

  readonly download: {
    startMonitoring(): Promise<void>;
    stopMonitoring(): Promise<void>;
    getStats(): Promise<DownloadStats>;
    resetSyncTime(resetTime: number): Promise<void>;
    signalUIActivity(): Promise<void>;
    onUpdate(callback: (data: DownloadUpdateData) => void): ListenerCleanup;
    removeAllListeners(): void;
  };

  readonly updater: {
    checkForUpdates(): Promise<UpdateCheckResult>;
    downloadUpdate(): Promise<void>;
    quitAndInstall(): Promise<void>;
    onStatus(callback: (status: UpdateStatus, data?: UpdateProgressInfo | UpdateInfo | Error) => void): ListenerCleanup;
  };

  readonly node: {
    platform(): string;
    arch(): string;
    httpsGet(url: string, options?: HttpsGetOptions): Promise<HttpsGetResult>;
    bufferFrom(data: string, encoding: BufferEncoding): ArrayBuffer;
    bufferFromArrayBuffer(arrayBuffer: ArrayBuffer): ArrayBuffer;
  };

  readonly shell: {
    openExternal(url: string): Promise<void>;
    showItemInFolder(fullPath: string): Promise<void>;
  };

  readonly utility: {
    estimatePOWPerformance(bits: number): Promise<{
      bits: number;
      coresUsed: number;
      totalCores: number;
      hashRatePerCore: string;
      totalHashRate: string;
      estimatedTime: string;
    }>;
    getLastUsedDestinationFolders(): Promise<ReadonlyArray<string>>;
    getLastUsedSourceFolders(): Promise<ReadonlyArray<string>>;
    rememberDestinationFolder(folder: string): Promise<void>;
    rememberSourceFolder(folder: string): Promise<void>;
  };
}

// ============================================================================
// Typed API Access Helper
// ============================================================================

/**
 * Get the typed Electron API with full type safety
 * @returns The ZenTransferAPI interface with all methods properly typed
 */
export function getElectronAPI(): ZenTransferAPI {
  if (!window.electronAPI) {
    throw new Error('Electron API not available. Make sure preload script is loaded.');
  }
  return window.electronAPI;
}

/**
 * Check if the Electron API is available
 * @returns True if the API is available, false otherwise
 */
export function isElectronAPIAvailable(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.electronAPI !== 'undefined' &&
         window.electronPreloadLoaded === true;
}

export default ZenTransferAPI;
