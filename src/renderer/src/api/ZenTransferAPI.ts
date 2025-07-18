import type { AppFile, FileStatus } from '../types/file';

// ============================================================================
// Base Interfaces
// ============================================================================




// ============================================================================
// App Interfaces
// ============================================================================

export interface VersionCheckResult {
  readonly success: boolean;
  readonly upToDate: boolean;
  readonly currentVersion: string;
  readonly latestVersion?: string;
  readonly error?: string;
}

export interface LogMeta {
  readonly [key: string]: unknown;
}

export interface ShowLogsFolderResult {
  readonly success: boolean;
  readonly error?: string;
}

export interface LogInfo {
  readonly size?: number;
  readonly path?: string;
  readonly exists?: boolean;
}

// ============================================================================
// Config Interfaces
// ============================================================================

export type CloudServiceType = 
  | 'zentransfer' 
  | 'aws-s3' 
  | 'azure-blob' 
  | 'gcp-storage' 
  | 'minio';

export interface CloudSettingsResult {
  readonly serviceType: string;
  readonly enabled: boolean;
  readonly [key: string]: unknown; // Additional service-specific properties
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


// ============================================================================
// Cloud Services Interfaces (imported from cloud.ts)
// ============================================================================

// Enhanced cloud service with runtime information
export interface CloudService {
  readonly type: CloudServiceType;
  readonly name: string;
  readonly enabled: boolean;
  readonly configured: boolean;
}

export interface EnabledService {
  readonly serviceType: CloudServiceType;
}

export interface AwsRegion {
  readonly code: string;
  readonly name: string;
  readonly location: string;
} 

// ============================================================================
// Dialog Interfaces
// ============================================================================



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

// ============================================================================
// Upload Interfaces
// ============================================================================

export interface UploadRequest {
  readonly path: string;
}

export interface UploadJob {
  readonly id: string;
  readonly status: 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  readonly fileName: string;
  readonly fileSize: number;
  readonly bytesTransferred: number;
  readonly errorMessage?: string;
}

export interface UploadStats {
  readonly queued: number;
  readonly uploading: number;
  readonly completed: number;
  readonly failed: number;
  readonly totalFiles: number;
  readonly totalSize: number;
}

// ============================================================================
// Import Interfaces
// ============================================================================

export interface ImportRequest {
  readonly path?: string;
}

export interface ImportJob {
  readonly id: string;
  readonly status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  readonly fileName: string;
  readonly fileSize: number;
  readonly errorMessage?: string;
}

export interface ImportStats {
  readonly totalFiles: number;
  readonly processedFiles: number;
  readonly skippedFiles: number;
  readonly errorFiles: number;
  readonly currentFile?: string;
  readonly progress: number;
}

// ============================================================================
// Download Interfaces
// ============================================================================

export interface DownloadJob {
  readonly type: 'queued' | 'downloading' | 'completed' | 'failed';
  readonly fileRecord: {
    readonly id: string | number;
    readonly name: string;
    readonly size: number;
    readonly type: string;
  };
  readonly downloadedBytes?: number;
  readonly errorMessage?: string;
}

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

// ============================================================================
// Auto-Updater Interfaces
// ============================================================================

export type UpdateStatus = 
  | 'ok'
  | 'outdated' 
  | 'required'
  | 'down'

export interface UpdateCheckResult {
  readonly status: UpdateStatus;
  readonly maintenanceUntil?: Date;
  readonly message?: string;
  readonly latestVersion?: string;
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
    
    getLastUsedDestinationFolders(): Promise<ReadonlyArray<string>>;
    getLastUsedSourceFolders(): Promise<ReadonlyArray<string>>;
    rememberDestinationFolder(folder: string): Promise<void>;
    rememberSourceFolder(folder: string): Promise<void>;
  };

  readonly auth: {
    hasValidToken(): Promise<boolean>;
    getToken(): Promise<string | null>;
    getEmail(): Promise<string | null>;
    initializeLogin(email: string): Promise<boolean>;
    finalizeLogin(otp: string): Promise<boolean>;
    validateConnection(): Promise<boolean>;
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
    addToQueue(files: ReadonlyArray<UploadRequest>): Promise<ReadonlyArray<UploadJob>>;
    cancelJob(jobId: string): Promise<boolean>;
    cancelAll(): Promise<void>;
    getQueueStats(): Promise<UploadStats>;
    onProgress(callback: (data: UploadJob) => void): ListenerCleanup;
    onUpdate(callback: (data: UploadJob) => void): ListenerCleanup;
  };

  readonly import: {
    start(source: ImportRequest): Promise<boolean>;
    cancel(): Promise<void>;
    
    onUpdate(callback: (data: ImportJob) => void): ListenerCleanup;
    onComplete(callback: (data: ImportJob) => void): ListenerCleanup;

    onImportStarted(callback: () => void): ListenerCleanup;
    onImportCompleted(callback: () => void): ListenerCleanup;

    getQueueStats(): Promise<ImportStats>;
  };

  readonly download: {
    startMonitoring(): Promise<void>;
    stopMonitoring(): Promise<void>;
    
    resetSyncTime(): Promise<void>;
    getLastSyncTime(): Promise<number>;
    signalUIActivity(): Promise<void>;

    onProgress(callback: (data: DownloadJob) => void): ListenerCleanup;
    onCompleted(callback: (data: DownloadJob) => void): ListenerCleanup;
    onError(callback: (data: DownloadJob) => void): ListenerCleanup;
    onUpdate(callback: (data: DownloadJob) => void): ListenerCleanup;

    onMonitoringStarted(callback: () => void): ListenerCleanup;
    onMonitoringStopped(callback: () => void): ListenerCleanup;
    removeAllListeners(): void;

    getStats(): Promise<DownloadStats>;
  };

  readonly updater: {
    checkForUpdates(): Promise<UpdateCheckResult>;
    downloadUpdate(): Promise<void>;
    quitAndInstall(): Promise<void>;
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
