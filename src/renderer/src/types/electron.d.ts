import type { IRendererLogger } from './logger';
import type { CloudServiceType, EnabledService, CloudSettingsResult, UpdateSettingsResult } from './cloud';

interface FileDialogOptions {
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

interface FileDialogResult {
  readonly canceled: boolean;
  readonly filePaths: ReadonlyArray<string>;
  readonly length?: number;
  readonly map?: <T>(callbackfn: (value: string, index: number, array: ReadonlyArray<string>) => T) => ReadonlyArray<T>;
}

interface LogInfo {
  readonly size?: number;
  readonly path?: string;
  readonly exists?: boolean;
}

interface ShowLogsFolderResult {
  readonly success: boolean;
  readonly error?: string;
}

interface ElectronAPI {
  readonly app: {
    getVersion(): Promise<string>;
    getIsDevelopmentMode(): Promise<boolean>;
    doVersionCheck(): Promise<unknown>;
    log(level: string, message: string, meta?: Record<string, unknown>): void;
    getLogInfo?(): Promise<LogInfo>;
    showLogsFolder?(): Promise<ShowLogsFolderResult>;
  };
  readonly config: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    getCloudSettings(serviceType: CloudServiceType): Promise<CloudSettingsResult>;
    updateCloudSettings(serviceType: CloudServiceType, settings: Record<string, unknown>): Promise<UpdateSettingsResult>;
  };
  readonly dialog: {
    showFileDialog(options: FileDialogOptions): Promise<FileDialogResult>;
  };
  readonly clouds: {
    getServices(): Promise<ReadonlyArray<CloudServiceType>>;
    getEnabledServices(): Promise<ReadonlyArray<EnabledService>>;
  };
}

declare global {
  interface Window {
    readonly electronAPI: ElectronAPI;
    logger: IRendererLogger;
    uploadSimulator?: unknown;
    uploadStore?: unknown;
  }
}

export {}; 