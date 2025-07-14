const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Import shared configuration
const sharedConfig = require('./src/shared/config.js');

// Import logger
const logger = require('./src/shared/logger.js');

// Import extracted modules
const { UploadWorkerPool } = require('./src/main/workers/upload-worker-pool.js');
const { ImportWorkerManager } = require('./src/main/workers/import-worker-manager.js');
const { DownloadWorkerManager } = require('./src/main/workers/download-worker-manager.js');
const { setupIpcHandlers } = require('./src/main/ipc/ipc-handlers.js');
const { AutoUpdaterManager } = require('./src/main/services/auto-updater-manager.js');

// Import Upload Service Manager
const { UploadServiceManager } = require(path.join(__dirname, 'src/workers', 'upload-service-manager.js'));

// Import Configuration Manager
const { initializeConfigManager } = require('./src/main/app/main-config-setup.js');

// Enable live reload for Electron in development
if (sharedConfig.isDevelopment || process.argv.includes('--dev')) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
    // Ignore node_modules and hidden files
    ignored: /node_modules|[\/\\]\./
  });
  logger.info('Development mode: electron-reload enabled');
}



// Global variables for worker pools and managers
let uploadWorkerPool;
let importWorkerPool;
let downloadWorkerPool;
let uploadServiceManager;
let autoUpdaterManager;



function createWindow() {
  // Calculate window dimensions for 9:16 aspect ratio
  const width = 400;
  const height = 780;

  const mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 350,
    minHeight: Math.round(350 * (16 / 9)),
    webPreferences: {
      nodeIntegration: false,        // Disable for security
      contextIsolation: true,        // Enable for security
      preload: path.join(__dirname, 'src/preload/index.js')
    },
    titleBarStyle: 'default',
    resizable: true,
    show: false
  });

  mainWindow.loadFile('src/renderer/index.html');

  // Hide the menu completely
  Menu.setApplicationMenu(null);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  logger.info('App ready, starting initialization...');
  
  // Initialize configuration manager first
  logger.info('Initializing configuration manager...');
  initializeConfigManager();
  logger.info('Configuration manager initialized');
  
  // Initialize auto-updater manager
  logger.info('Initializing auto-updater manager...');
  autoUpdaterManager = new AutoUpdaterManager();
  autoUpdaterManager.initialize();
  logger.info('Auto-updater manager initialized');
  
  // Initialize upload worker pool
  logger.info('Initializing upload worker pool...');
  uploadWorkerPool = new UploadWorkerPool(3);
  logger.info('Upload worker pool initialized with 3 workers');
  
  // Initialize import worker manager
  logger.info('Initializing import worker manager...');
  importWorkerPool = new ImportWorkerManager();
  logger.info('Import worker manager initialized');
  
  // Initialize download worker manager
  logger.info('Initializing download worker manager...');
  downloadWorkerPool = new DownloadWorkerManager();
  logger.info('Download worker manager initialized');
  
  // Initialize upload service manager
  logger.info('Initializing upload service manager...');
  uploadServiceManager = new UploadServiceManager();
  logger.info('Upload service manager initialized');
  
  // Create main window
  logger.info('Creating main window...');
  createWindow();
  logger.info('Main window created');
  
  // Set up IPC handlers
  logger.info('Setting up IPC handlers...');
  setupIpcHandlers(uploadWorkerPool, importWorkerPool, downloadWorkerPool, uploadServiceManager);
  logger.info('IPC handlers configured');
  
  logger.info('ZenTransfer application initialization completed successfully');
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    logger.info('Quitting application (non-macOS platform)');
    app.quit();
  } else {
    logger.info('Keeping application running (macOS platform)');
  }
});

app.on('activate', () => {
  logger.info('Application activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    logger.info('No windows open, creating new window');
    createWindow();
  }
});

