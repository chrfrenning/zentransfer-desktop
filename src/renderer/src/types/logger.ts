export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';

export interface LogMetadata {
  readonly [key: string]: unknown;
}

export interface ErrorMetadata extends LogMetadata {
  readonly name?: string | undefined;
  readonly message?: string | undefined;
  readonly stack?: string | undefined;
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

export interface IRendererLogger {
  error(message: string, meta?: LogMetadata | Error): void;
  warn(message: string, meta?: LogMetadata): void;
  info(message: string, meta?: LogMetadata): void;
  verbose(message: string, meta?: LogMetadata): void;
  debug(message: string, meta?: LogMetadata): void;
  silly(message: string, meta?: LogMetadata): void;
  getLogInfo(): Promise<LogInfo | null>;
  showLogsFolder(): Promise<ShowLogsFolderResult>;
  formatFileSize(bytes: number): string;
} 