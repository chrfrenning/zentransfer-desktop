/**
 * Renderer Logger
 * Provides a convenient logging API for the renderer process
 * Sends logs to the main process for file logging while also optionally logging to console
 */

class RendererLogger {
  constructor() {
    this.levels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
  }

  /**
   * Internal log method that handles both console output and IPC communication
   * @param {string} level - Log level 
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  _log(level, message, meta = {}) {
    // Validate level
    if (!this.levels.includes(level)) {
      level = 'info';
      console.log("Level not valid, setting to info");
    }

    // Log to console for immediate feedback
    const consoleMethod = ['error', 'warn'].includes(level) ? level : 'log';
    if (meta) {
      console[consoleMethod](`[${level.toUpperCase()}]`, message, meta);
    } else {
      console[consoleMethod](`[${level.toUpperCase()}]`, message);
    }
    
    // Send to main process for file logging
    window.electronAPI.app.log(level, message, meta);
  }

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Object|Error} meta - Additional metadata or Error object
   */
  error(message, meta = {}) {
    // Handle Error objects specially
    if (meta instanceof Error) {
      meta = {
        name: meta.name,
        message: meta.message,
        stack: meta.stack,
        ...meta
      };
    }
    this._log('error', message, meta);
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  /**
   * Log a verbose message
   * @param {string} message - Verbose message
   * @param {Object} meta - Additional metadata
   */
  verbose(message, meta = {}) {
    this._log('verbose', message, meta);
  }

  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  /**
   * Log a silly level message
   * @param {string} message - Silly message
   * @param {Object} meta - Additional metadata
   */
  silly(message, meta = {}) {
    this._log('silly', message, meta);
  }

  /**
   * Get log file information
   * @returns {Promise<Object|null>} Log file information
   */
  async getLogInfo() {
    if (window.electronAPI && window.electronAPI.app.getLogInfo) {
      try {
        return await window.electronAPI.app.getLogInfo();
      } catch (error) {
        this.error('Failed to get log info', { error: error.message });
        return null;
      }
    }
    return null;
  }

  /**
   * Show the logs folder in the system file explorer
   * @returns {Promise<Object>} Result object with success status
   */
  async showLogsFolder() {
    if (window.electronAPI && window.electronAPI.app.showLogsFolder) {
      try {
        const result = await window.electronAPI.app.showLogsFolder();
        if (result.success) {
          this.info('Opened logs folder for user');
        } else {
          this.error('Failed to open logs folder', { error: result.error });
        }
        return result;
      } catch (error) {
        this.error('Error opening logs folder', { error: error.message });
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'ElectronAPI not available' };
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Create and export a singleton logger instance
window.logger = new RendererLogger();
console.log('RendererLogger: Module loaded successfully'); 