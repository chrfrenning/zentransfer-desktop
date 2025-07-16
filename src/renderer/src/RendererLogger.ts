/**
 * Renderer Logger
 * Provides a convenient logging API for the renderer process
 * Sends logs to the main process for file logging while also optionally logging to console
 */

import type { 
  LogLevel, 
  LogMetadata, 
  ErrorMetadata, 
  LogInfo, 
  ShowLogsFolderResult, 
  IRendererLogger 
} from './types/logger';

class RendererLogger implements IRendererLogger {
  private readonly levels: ReadonlyArray<LogLevel> = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

  /**
   * Internal log method that handles both console output and IPC communication
   */
  private _log(level: LogLevel, message: string, meta: LogMetadata = {}): void {
    // Validate level
    let validLevel: LogLevel = level;
    if (!this.levels.includes(level)) {
      validLevel = 'info';
      console.log("Level not valid, setting to info");
    }

    // Log to console for immediate feedback
    const consoleMethod: 'error' | 'warn' | 'log' = ['error', 'warn'].includes(validLevel) 
      ? (validLevel as 'error' | 'warn') 
      : 'log';
    
    if (Object.keys(meta).length > 0) {
      console[consoleMethod](`[${validLevel.toUpperCase()}]`, message, meta);
    } else {
      console[consoleMethod](`[${validLevel.toUpperCase()}]`, message);
    }
    
    // Send to main process for file logging
    window.electronAPI.app.log(validLevel, message, meta);
  }

  /**
   * Log an error message
   */
  public error(message: string, meta: LogMetadata | Error = {}): void {
    let errorMeta: ErrorMetadata;
    
    // Handle Error objects specially
    if (meta instanceof Error) {
      errorMeta = {
        name: meta.name,
        message: meta.message,
        stack: meta.stack,
        cause: meta.cause
      };
    } else {
      errorMeta = meta;
    }
    
    this._log('error', message, errorMeta);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, meta: LogMetadata = {}): void {
    this._log('warn', message, meta);
  }

  /**
   * Log an info message
   */
  public info(message: string, meta: LogMetadata = {}): void {
    this._log('info', message, meta);
  }

  /**
   * Log a verbose message
   */
  public verbose(message: string, meta: LogMetadata = {}): void {
    this._log('verbose', message, meta);
  }

  /**
   * Log a debug message
   */
  public debug(message: string, meta: LogMetadata = {}): void {
    this._log('debug', message, meta);
  }

  /**
   * Log a silly level message
   */
  public silly(message: string, meta: LogMetadata = {}): void {
    this._log('silly', message, meta);
  }

  /**
   * Get log file information
   */
  public async getLogInfo(): Promise<LogInfo | null> {
    if (window.electronAPI?.app.getLogInfo) {
      try {
        return await window.electronAPI.app.getLogInfo();
      } catch (error) {
        this.error('Failed to get log info', { error: error instanceof Error ? error.message : String(error) });
        return null;
      }
    }
    return null;
  }

  /**
   * Show the logs folder in the system file explorer
   */
  public async showLogsFolder(): Promise<ShowLogsFolderResult> {
    if (window.electronAPI?.app.showLogsFolder) {
      try {
        const result = await window.electronAPI.app.showLogsFolder();
        if (result.success) {
          this.info('Opened logs folder for user');
        } else {
          this.error('Failed to open logs folder', { error: result.error });
        }
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.error('Error opening logs folder', { error: errorMessage });
        return { success: false, error: errorMessage };
      }
    }
    return { success: false, error: 'ElectronAPI not available' };
  }

  /**
   * Format file size for display
   */
  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'] as const;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = sizes[i];
    if (!size) return `${bytes} Bytes`; // Fallback for very large files
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${size}`;
  }
}

// Create and export a singleton logger instance
window.logger = new RendererLogger();
console.log('RendererLogger: Module loaded successfully'); 