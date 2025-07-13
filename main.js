const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Import shared configuration
const sharedConfig = require('./src/shared/config.js');

// Import extracted modules
const { UploadWorkerPool } = require('./src/main/workers/upload-worker-pool.js');
const { ImportWorkerManager } = require('./src/main/workers/import-worker-manager.js');
const { DownloadWorkerManager } = require('./src/main/workers/download-worker-manager.js');
const { setupIpcHandlers } = require('./src/main/ipc/ipc-handlers.js');
const { AutoUpdaterManager } = require('./src/main/services/auto-updater-manager.js');

// Import Upload Service Manager
const { UploadServiceManager } = require(path.join(__dirname, 'src/workers', 'upload-service-manager.js'));

// Enable live reload for Electron in development
if (sharedConfig.isDevelopment || process.argv.includes('--dev')) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
    // Ignore node_modules and hidden files
    ignored: /node_modules|[\/\\]\./
  });
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
  // Initialize auto-updater manager
  autoUpdaterManager = new AutoUpdaterManager();
  autoUpdaterManager.initialize();
  
  // Initialize upload worker pool
  uploadWorkerPool = new UploadWorkerPool(3);
  
  // Initialize import worker manager
  importWorkerPool = new ImportWorkerManager();
  
  // Initialize download worker manager
  downloadWorkerPool = new DownloadWorkerManager();
  
  // Initialize upload service manager
  uploadServiceManager = new UploadServiceManager();
  
  createWindow();
  
  // Set up IPC handlers
  setupIpcHandlers(uploadWorkerPool, importWorkerPool, downloadWorkerPool, uploadServiceManager);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

