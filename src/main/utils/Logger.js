const { app } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');

// Initialize electron-log only once
let isInitialized = false;

function setupLogger() {
  if (isInitialized) {
    return log;
  }

  try {
    // Set log levels based on environment
    const isDevelopment = app.isDevelopmentMode;
    log.transports.console.level = isDevelopment ? 'debug' : 'info';
    log.transports.file.level = 'debug';

    // Configure file transport
    log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB max file size
    
    // Set custom log file location in Logs directory (peer to Configuration)
    const userDataPath = app.getPath('userData');
    const logDir = path.join(userDataPath, 'Logs');
    const logPath = path.join(logDir, 'zentransfer.log');
    
    // Ensure Logs directory exists
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create logs directory:', err);
    }
    
    log.transports.file.resolvePathFn = () => logPath;

    // Format logs with timestamp and process type
    const getProcessType = () => {
      if (process.type === 'renderer') return 'renderer';
      if (process.type === 'worker') return 'worker';
      return 'main';
    };

    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{processType}] {text}';
    log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] [{processType}] {text}';

    // Override the default variables to include process type
    log.variables.processType = getProcessType();

    // Set up log rotation and cleanup
    setupLogRotationAndCleanup(app);

    // We're good to go
    isInitialized = true;
    log.info('Logger initialized successfully');
    
  } catch (error) {

    console.error('Failed to setup logger:', error);
    
    // Fallback to console if electron-log fails
    return {
      error: (...args) => console.error(...args),
      warn: (...args) => console.warn(...args),
      info: (...args) => console.log(...args),
      verbose: (...args) => console.log(...args),
      debug: (...args) => console.log(...args),
      silly: (...args) => console.log(...args)
    };
  }

  return log;
}

function setupLogRotationAndCleanup(app) {
  if (!app) return;

  // Clean up old log files on startup (after a delay)
  setTimeout(() => {
    cleanupOldLogs(app);
  }, 2 * 60 * 1000);

  // Set up periodic cleanup (once per day)
  setInterval(() => {
    cleanupOldLogs(app);
  }, 24 * 60 * 60 * 1000); // 24 hours
}

function cleanupOldLogs(app) {
  if (!app) return;
  
  try {
    const userDataPath = app.getPath('userData');
    const logDir = path.join(userDataPath, 'Logs');
    
    if (!fs.existsSync(logDir)) {
      return;
    }

    const files = fs.readdirSync(logDir);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    files.forEach(file => {
      try {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        
        // Only delete log files (not directories), and only if they're older than 30 days
        if (stats.isFile() && 
            file.endsWith('.log') && 
            file !== 'zentransfer.log' && // Don't delete current log file
            stats.mtime.getTime() < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      } catch (error) {
        log.warn(`Failed to clean up log file ${file}:`, error.message);
      }
    });
    
    if (cleanedCount > 0) {
      log.info(`Cleaned up ${cleanedCount} old log files`);
    }
  } catch (error) {
    log.error('Error during log cleanup:', error);
  }
}

// Get log file information
function getLogInfo() {
  try {
    let app;
    try {
      app = require('electron').app;
    } catch (error) {
      return null;
    }

    if (!app) return null;

    const logFilePath = log.transports.file.getFile().path;
    if (!fs.existsSync(logFilePath)) {
      return null;
    }

    const stats = fs.statSync(logFilePath);
    
    return {
      path: logFilePath,
      size: stats.size,
      lastModified: stats.mtime,
      directory: path.dirname(logFilePath)
    };
  } catch (error) {
    log.error('Failed to get log info:', error);
    return null;
  }
}

// Create and export the configured logger
const logger = setupLogger();

// Add convenience method for getting log info
logger.getLogInfo = getLogInfo;

module.exports = logger;