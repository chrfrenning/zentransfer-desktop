const { parentPort, workerData } = require('worker_threads');

class WorkerLogger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      verbose: 3,
      debug: 4,
      silly: 5
    };
    
    // Default log level
    this.level = workerData?.logLevel || 'info';
  }

  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  _formatMessage(level, args) {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    return `[${timestamp}] [${level.toUpperCase()}] [worker] ${message}`;
  }

  _log(level, ...args) {
    if (!this._shouldLog(level)) {
      return;
    }

    const formattedMessage = this._formatMessage(level, args);
    
    // Send to parent port if available
    if (parentPort) {
      try {
        parentPort.postMessage({
          type: 'log',
          level: level,
          message: formattedMessage,
          timestamp: new Date().toISOString(),
          args: args
        });
      } catch (error) {
        // Fallback to console if parentPort fails
        console[level] || console.log(formattedMessage);
      }
    } else {
      // Fallback to console if no parentPort
      console[level] || console.log(formattedMessage);
    }
  }

  error(...args) {
    this._log('error', ...args);
  }

  warn(...args) {
    this._log('warn', ...args);
  }

  info(...args) {
    this._log('info', ...args);
  }

  verbose(...args) {
    this._log('verbose', ...args);
  }

  debug(...args) {
    this._log('debug', ...args);
  }

  silly(...args) {
    this._log('silly', ...args);
  }

  // Compatibility method with main Logger.js
  getLogInfo() {
    return {
      path: 'worker-thread',
      size: 0,
      lastModified: new Date(),
      directory: 'worker-thread'
    };
  }

  // Set log level dynamically
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.level = level;
    }
  }
}

// Create and export the logger instance
const logger = new WorkerLogger();

module.exports = logger;

