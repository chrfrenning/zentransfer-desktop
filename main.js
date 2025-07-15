const { app, globalShortcut, BrowserWindow, Menu, systemPreferences } = require('electron');
const path = require('path');

/*
  Determine runtime mode and configuration

  We need our globals and configuration very early to be able to setup
  the app in the right way.
*/

// Are we running in development mode?
function getIsDevelopment() {
  // Check for --dev command line argument
  if (typeof process !== 'undefined' && process.argv && process.argv.includes('--dev')) {
      return true;
  }

  return false;
}

// I just love myself a good global variable.
app.isDevelopmentMode = getIsDevelopment();
console.log('ZenTransfer is running in ' + (app.isDevelopmentMode ? 'development' : 'production') + ' mode');

// Set up global information
const zenTransferGlobals = require('./src/main/configuration/Globals.js');
app.globals = zenTransferGlobals;

// Get started with logging
const logger = require('./src/main/utils/Logger.js');
app.logger = logger;

// Start info
logger.info(`Starting ZenTransfer app version ${app.getVersion()}`);

// Disable hardware acceleration for now
logger.debug('Disabling hardware acceleration');
app.disableHardwareAcceleration();

// Now load or initialize the configuration
const { ConfigurationManager } = require('./src/main/configuration/ConfigurationManager.js');
app.configurationManager = new ConfigurationManager(zenTransferGlobals.serverBaseUrl);
logger.info('Configuration loaded from ' + app.configurationManager.getConfigFilename());
logger.info('Device ID: ' + app.configurationManager.get('deviceId'));

// Enable live reload for Electron in development
if (getIsDevelopment()) {
  logger.info('Development mode: enabling electron-reload');

  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
    // Ignore node_modules and hidden files
    ignored: /node_modules|[\/\\]\./
  });

  logger.debug('electron-reload enabled');
}



/*
 *
 * Stage 1 of startup: Check for updates
 *
*/

const forceUpdateInDevMode = false;

const { ZenTransferGitHubAutoUpdater } = require('./src/main/services/AutoUpdate.js');
app.autoUpdater = new ZenTransferGitHubAutoUpdater(forceUpdateInDevMode);
app.autoUpdater.checkForUpdates().then((result) => {
  if ( result ) {
    if ( result.isUpdateAvailable ) {
      console.log(`ZenTransfer has a new version available: ${result.versionInfo.version} released on ${result.versionInfo.releaseDate}`);
    } else {
      console.log(`ZenTransfer is up to date`);
    }
  }

  setupAuthenticationAndTokenRefresh();
});



/*
 *
 * Stage 2 of startup: Setup authentication and token refresh
 *
*/

function setupAuthenticationAndTokenRefresh() {
  // Import Auth Service
  const { ZenTransferAuthenticationService } = require('./src/main/services/auth/ZenTransferAuthenticationService.js');
  app.authenticationService = new ZenTransferAuthenticationService(app.configurationManager);

  // Upload session
  const { UploadSession } = require('./src/main/services/auth/UploadSession.js');
  app.uploadSession = new UploadSession();

  // Import Token Manager
  const { TokenManager } = require('./src/main/services/auth/TokenManager.js');
  app.tokenManager = new TokenManager(app.configurationManager, app.authenticationService);

  logger.info('Authentication and Token handling is initialized');

  setupWorkerPools();
}



/*
 *
 * Stage 3 of startup: Setup worker pools
 *
*/

function setupWorkerPools() {
  // Get pool sizes (or defaults) from config data
  const uploadWorkerPoolSize = app.configurationManager.get('workerPools.uploadWorkerPoolSize');
  const importWorkerPoolSize = app.configurationManager.get('workerPools.importWorkerPoolSize');
  const downloadWorkerPoolSize = app.configurationManager.get('workerPools.downloadWorkerPoolSize');
  logger.info('Setting up worker pools with sizes: upload=' + uploadWorkerPoolSize + ', import=' + importWorkerPoolSize + ', download=' + downloadWorkerPoolSize);

  // Initialize the pools
  const { UploadWorkerPool } = require('./src/main/pools/UploadWorkerPool.js');
  app.uploadWorkerPool = new UploadWorkerPool(uploadWorkerPoolSize);

  const { DownloadWorkerPool } = require('./src/main/pools/DownloadWorkerPool.js');
  app.downloadWorkerPool = new DownloadWorkerPool(downloadWorkerPoolSize);

  const { ImportWorkerPool } = require('./src/main/pools/ImportWorkerPool.js');
  app.importWorkerPool = new ImportWorkerPool(importWorkerPoolSize);

  setupHandlersBetweenRendererAndMainProcess();
}



/*
 *
 * Stage 4 of startup: Setup IPC handlers and keyboard shortcuts
 *
*/

function setupHandlersBetweenRendererAndMainProcess() {
  const { setupIpcHandlers } = require('./src/main/ipc/IpcHandlers.js');
  
  // Set up IPC handlers
  logger.info('Setting up IPC handlers...');
  setupIpcHandlers(app.uploadWorkerPool, app.importWorkerPool, app.downloadWorkerPool, app.uploadServiceManager, app.mainTokenManager, app.mainAuthService);
  logger.info('IPC handlers configured');

  createAndShowMainWindow();
}



/*
 *
 * Stage 5 of startup: Create and show the main window
 *
*/

function createAndShowMainWindow() {
  logger.info('Foundation ready, can let in the user now...');

  app.whenReady().then(async () => {

    // Register global shortcut for devtools
    registerGlobalShortcuts();
    
    // Create main window
    logger.info('Creating main window...');
    app.mainWindow = createWindow();
    logger.info('Main window created');
    
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
  
  /* app.on('activate', () => {
    logger.info('Application activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      logger.info('No windows open, creating new window');
      app.mainWindow = createWindow();
    }
  }); */
  
}

function registerGlobalShortcuts() {
  // Register global shortcut for devtools
  logger.info('Registering global shortcut for devtools...');
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    app.mainWindow.webContents.openDevTools();
  });
  logger.info('Global shortcut for devtools registered');
}

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
      preload: path.join(__dirname, 'src/preload/preload.js')
    },
    titleBarStyle: 'default',
    resizable: true,
    show: false
  });

  mainWindow.loadFile('src/renderer/index.html');

  // Hide the menu completely on Windows
  if (process.platform === 'win32') {
    Menu.setApplicationMenu(null);
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Open DevTools in development
    if (true || process.argv.includes('--devtools')) {
      mainWindow.webContents.openDevTools();
  }
  });

  return mainWindow;
}


