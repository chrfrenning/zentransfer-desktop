/**
 * IPC Handlers
 * Sets up Inter-Process Communication handlers between main and renderer processes
 * Extracted from main.js for better modularity
 */

const { ipcMain, dialog, app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

// Import shared configuration
const sharedConfig = require('../../shared/config.js');

// Import configuration management
const {
  getConfig,
  setConfig,
  getCloudService,
  updateCloudService,
  getEnabledCloudServices,
  getCloudServicesDisplayInfo,
  validateCloudServices,
  migrateFromLocalStorage,
  needsMigration,
  getConfigPath,
  getHostname,
  getServerUrl,
  exportConfig
} = require('../app/main-config-setup.js');

function setupIpcHandlers(uploadWorkerPool, importWorkerPool, downloadWorkerPool, uploadServiceManager) {
  // Handle log messages from renderer
  ipcMain.on('log-to-stdout', (event, message) => {
    console.log(`[Renderer] ${message}`);
  });
  
  // Handle directory dialog requests
  ipcMain.handle('show-directory-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Download Directory'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    
    return null;
  });
  
  // Handle file dialog requests
  ipcMain.handle('show-file-dialog', async (event, options = {}) => {
    const defaultOptions = {
      properties: ['openFile', 'multiSelections'],
      title: 'Select Files',
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    
    const dialogOptions = { ...defaultOptions, ...options };
    
    const result = await dialog.showOpenDialog(dialogOptions);
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths;
    }
    
    return [];
  });
  
  // Handle upload session creation
  ipcMain.handle('create-upload-session', async (event, sessionData) => {
    try {
      const result = await uploadWorkerPool.execute({
        type: 'create-session',
        sessionData
      });
      return { success: true, session: result };
    } catch (error) {
      console.error('Failed to create upload session:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Handle file upload
  ipcMain.handle('upload-file', async (event, fileData, sessionData) => {
    try {
      const result = await uploadWorkerPool.execute({
        type: 'upload-file',
        fileData,
        sessionData
      });
      return { success: true, result };
    } catch (error) {
      console.error('File upload failed:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Get worker pool stats
  ipcMain.handle('get-upload-stats', async () => {
    return uploadWorkerPool.getStats();
  });
  
  // Cancel all uploads
  ipcMain.handle('cancel-all-uploads', async () => {
    try {
      uploadWorkerPool.cancelAllJobs();
      return { success: true };
    } catch (error) {
      console.error('Failed to cancel uploads:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Import handlers
  ipcMain.handle('start-import', async (event, importSettings) => {
    try {
      const result = await importWorkerPool.startImport(importSettings);
      return { success: true, result };
    } catch (error) {
      console.error('Import failed:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('cancel-import', async (event) => {
    try {
      console.log('Main process: Received cancel-import IPC request');
      importWorkerPool.stopImport();
      console.log('Main process: stopImport completed');
      return { success: true };
    } catch (error) {
      console.error('Cancel import failed:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Download handlers
  ipcMain.handle('start-download-monitoring', async (event) => {
    try {
      // Get download settings from config
      const downloadSettings = getConfig('downloadSettings');
      const downloadPath = downloadSettings?.downloadPath;
      const lastSyncTime = downloadSettings?.lastSyncTime || '2025-01-01T00:00:00.000Z';
      
      // Get authentication token from config
      const authToken = getConfig('authToken');
      
      if (!downloadPath) {
        throw new Error('Download path not configured');
      }
      
      if (!authToken) {
        throw new Error('Authentication token not available');
      }
      
      const result = await downloadWorkerPool.startMonitoring(downloadPath, lastSyncTime, authToken);
      return { success: true, result };
    } catch (error) {
      console.error('Download monitoring failed:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('stop-download-monitoring', async (event) => {
    try {
      console.log('Main process: Received stop-download-monitoring IPC request');
      downloadWorkerPool.stopMonitoring();
      console.log('Main process: stopMonitoring completed');
      return { success: true };
    } catch (error) {
      console.error('Stop download monitoring failed:', error);
      return { success: false, error: error.message };
    }
  });
  
   ipcMain.handle('get-download-stats', async () => {
     return downloadWorkerPool.getStats();
   });
   
   // Update sync time
   ipcMain.handle('update-sync-time', async (event, syncTime) => {
     try {
       if (downloadWorkerPool.isMonitoring) {
         downloadWorkerPool.lastSyncTime = syncTime;
         console.log(`Updated sync time to: ${syncTime}`);
       }
       return { success: true };
     } catch (error) {
       console.error('Failed to update sync time:', error);
       return { success: false, error: error.message };
     }
   });
   
   // Reset sync time (clears both lastSyncTime and latestDownloadedFileTime)
   ipcMain.handle('reset-sync-time', async (event, syncTime) => {
     try {
       downloadWorkerPool.lastSyncTime = syncTime;
       downloadWorkerPool.latestDownloadedFileTime = null; // Clear the cached latest time
       
       // Clear the entire download queue database
       // Ensure queue manager is initialized before trying to clear it
       if (!downloadWorkerPool.getQueueManager()) {
         console.log('IPC reset-sync-time: Queue manager not initialized, initializing now');
         const { getConfigManager } = require('../app/main-config-setup.js');
         downloadWorkerPool.initializeQueue(getConfigManager());
       }
       
       const queueManager = downloadWorkerPool.getQueueManager();
       console.log('IPC reset-sync-time: queueManager found:', !!queueManager);
       if (queueManager) {
         console.log('IPC reset-sync-time: About to call clearAll()');
         const clearResult = queueManager.clearAll();
         console.log('IPC reset-sync-time: clearAll() returned:', clearResult);
         console.log('Cleared entire download queue database');
         
         // Send notification to renderer
         const allWindows = BrowserWindow.getAllWindows();
         allWindows.forEach(window => {
           window.webContents.send('download-update', {
             type: 'queue-cleared',
             message: 'Download queue cleared'
           });
         });
       } else {
         console.log('IPC reset-sync-time: No queueManager found');
       }
       
       // Also save to config system
       setConfig('downloadSettings.lastSyncTime', syncTime);
       
       console.log(`Reset sync time to: ${syncTime}, cleared latest downloaded file time and download queue`);
       return { success: true };
     } catch (error) {
       console.error('Failed to reset sync time:', error);
       return { success: false, error: error.message };
     }
   });
   
   // Reset server polling backoff on UI activity
   ipcMain.handle('ui-activity', async (event) => {
     try {
       if (downloadWorkerPool && downloadWorkerPool.isMonitoring) {
         downloadWorkerPool.resetBackoff();
       }
       return { success: true };
     } catch (error) {
       console.error('Failed to handle UI activity:', error);
       return { success: false, error: error.message };
     }
   });
   
   // Upload Service handlers
   ipcMain.handle('upload-service-create', async (event, serviceType, settings) => {
     try {
       const serviceInfo = uploadServiceManager.createService(serviceType, settings);
       return { success: true, serviceInfo };
     } catch (error) {
       console.error('Failed to create upload service:', error);
       return { success: false, error: error.message };
     }
   });
   
   ipcMain.handle('upload-service-test', async (event, serviceType) => {
     try {
       const result = await uploadServiceManager.testService(serviceType);
       return { success: true, result };
     } catch (error) {
       console.error('Failed to test upload service:', error);
       return { success: false, error: error.message };
     }
   });
   
   ipcMain.handle('upload-service-update', async (event, serviceType, settings) => {
     try {
       const serviceInfo = uploadServiceManager.updateService(serviceType, settings);
       return { success: true, serviceInfo };
     } catch (error) {
       console.error('Failed to update upload service:', error);
       return { success: false, error: error.message };
     }
   });
   
   ipcMain.handle('upload-service-get-display-info', async (event, serviceType) => {
     try {
       const displayInfo = uploadServiceManager.getServiceDisplayInfo(serviceType);
       return { success: true, displayInfo };
     } catch (error) {
       console.error('Failed to get service display info:', error);
       return { success: false, error: error.message };
     }
   });
   
   ipcMain.handle('upload-service-create-from-preferences', async (event, preferences) => {
     try {
       const services = uploadServiceManager.createServicesFromPreferences(preferences);
       return { success: true, services };
     } catch (error) {
       console.error('Failed to create services from preferences:', error);
       return { success: false, error: error.message };
     }
   });
   
   ipcMain.handle('upload-service-get-all', async (event) => {
     try {
       const services = uploadServiceManager.getAllServices();
       return { success: true, services };
     } catch (error) {
       console.error('Failed to get all services:', error);
       return { success: false, error: error.message };
     }
   });
   
   // App quit handler
   ipcMain.handle('app-quit', async (event) => {
     try {
       console.log('Received app quit request from renderer');
       
       // Cancel all active operations
       if (uploadWorkerPool) {
         uploadWorkerPool.cancelAllJobs();
       }
       
       if (downloadWorkerPool && downloadWorkerPool.isMonitoring) {
         downloadWorkerPool.stopMonitoring();
       }
       
       if (importWorkerPool && importWorkerPool.isImporting) {
         importWorkerPool.stopImport();
       }
       
       // Give a brief moment for cleanup
       setTimeout(() => {
         console.log('Quitting application...');
         app.quit();
       }, 200);
       
       return { success: true };
     } catch (error) {
       console.error('Failed to quit app:', error);
       // Still try to quit even if there was an error
       app.quit();
       return { success: false, error: error.message };
     }
   });
   
   // Auto-update handlers
   ipcMain.handle('check-for-updates', async () => {
     try {
       const result = await autoUpdater.checkForUpdates();
       return { success: true, result };
     } catch (error) {
       console.error('Failed to check for updates:', error);
       return { success: false, error: error.message };
     }
   });
   
   ipcMain.handle('download-update', async () => {
     try {
       await autoUpdater.downloadUpdate();
       return { success: true };
     } catch (error) {
       console.error('Failed to download update:', error);
       return { success: false, error: error.message };
     }
   });
   
   ipcMain.handle('quit-and-install', async () => {
     try {
       autoUpdater.quitAndInstall();
       return { success: true };
     } catch (error) {
       console.error('Failed to quit and install:', error);
       return { success: false, error: error.message };
     }
   });
   
   // App version handler
   ipcMain.handle('get-app-version', async () => {
     return app.getVersion();
   });

   // Configuration handler
   ipcMain.handle('get-config', async () => {
     return sharedConfig;
   });
   
   // Build information handler
   ipcMain.handle('get-build-info', async () => {
     return sharedConfig.buildInfo;
   });

   // Node.js operation handlers - secure Node.js access for renderer
   const fs = require('fs');
   const path = require('path');
   const os = require('os');
   const http = require('http');
   const https = require('https');

   // Synchronous IPC handlers using sendSync
   ipcMain.on('node-fs-readFileSync', (event, filePath) => {
     try {
       event.returnValue = fs.readFileSync(filePath, 'utf8');
     } catch (error) {
       event.returnValue = { error: error.message };
     }
   });

   ipcMain.on('node-fs-writeFileSync', (event, filePath, data) => {
     try {
       fs.writeFileSync(filePath, data, 'utf8');
       event.returnValue = true;
     } catch (error) {
       event.returnValue = { error: error.message };
     }
   });

   ipcMain.on('node-fs-existsSync', (event, filePath) => {
     try {
       event.returnValue = fs.existsSync(filePath);
     } catch (error) {
       event.returnValue = false;
     }
   });

   ipcMain.on('node-fs-mkdirSync', (event, dirPath, options = {}) => {
     try {
       fs.mkdirSync(dirPath, options);
       event.returnValue = true;
     } catch (error) {
       event.returnValue = { error: error.message };
     }
   });

   ipcMain.on('node-fs-statSync', (event, filePath) => {
     try {
       const stats = fs.statSync(filePath);
       // Convert fs.Stats to plain object with methods as properties
       event.returnValue = {
         size: stats.size,
         mode: stats.mode,
         mtime: stats.mtime,
         ctime: stats.ctime,
         birthtime: stats.birthtime,
         isFile: stats.isFile(),
         isDirectory: stats.isDirectory(),
         isSymbolicLink: stats.isSymbolicLink(),
         isBlockDevice: stats.isBlockDevice(),
         isCharacterDevice: stats.isCharacterDevice(),
         isFIFO: stats.isFIFO(),
         isSocket: stats.isSocket()
       };
     } catch (error) {
       event.returnValue = { error: error.message };
     }
   });

   ipcMain.on('node-fs-readdirSync', (event, dirPath) => {
     try {
       event.returnValue = fs.readdirSync(dirPath);
     } catch (error) {
       event.returnValue = { error: error.message };
     }
   });

   ipcMain.on('node-fs-copyFileSync', (event, src, dest) => {
     try {
       fs.copyFileSync(src, dest);
       event.returnValue = true;
     } catch (error) {
       event.returnValue = { error: error.message };
     }
   });

   // Path operations
   ipcMain.on('node-path-join', (event, ...paths) => {
     event.returnValue = path.join(...paths);
   });

   ipcMain.on('node-path-dirname', (event, filePath) => {
     event.returnValue = path.dirname(filePath);
   });

   ipcMain.on('node-path-basename', (event, filePath, ext) => {
     event.returnValue = path.basename(filePath, ext);
   });

   ipcMain.on('node-path-extname', (event, filePath) => {
     event.returnValue = path.extname(filePath);
   });

   ipcMain.on('node-path-resolve', (event, ...paths) => {
     event.returnValue = path.resolve(...paths);
   });

   // OS operations
   ipcMain.on('node-os-homedir', (event) => {
     event.returnValue = os.homedir();
   });

   ipcMain.on('node-os-tmpdir', (event) => {
     event.returnValue = os.tmpdir();
   });

   ipcMain.on('node-os-platform', (event) => {
     event.returnValue = os.platform();
   });

   ipcMain.on('node-os-arch', (event) => {
     event.returnValue = os.arch();
   });

   // Buffer operations
   ipcMain.on('node-buffer-from', (event, data, encoding) => {
     try {
       if (encoding) {
         event.returnValue = Buffer.from(data, encoding);
       } else {
         event.returnValue = Buffer.from(data);
       }
     } catch (error) {
       event.returnValue = { error: error.message };
     }
   });

   ipcMain.on('node-buffer-from-arraybuffer', (event, arrayBuffer) => {
     try {
       event.returnValue = Buffer.from(arrayBuffer);
     } catch (error) {
       event.returnValue = { error: error.message };
     }
   });

   // Shell API handlers
   const { shell } = require('electron');
   
   ipcMain.handle('shell-openExternal', async (event, url) => {
     try {
       await shell.openExternal(url);
       return { success: true };
     } catch (error) {
       return { success: false, error: error.message };
     }
   });

   ipcMain.handle('shell-openPath', async (event, path) => {
     try {
       const result = await shell.openPath(path);
       return { success: true, result };
     } catch (error) {
       return { success: false, error: error.message };
     }
   });

   ipcMain.handle('shell-showItemInFolder', async (event, fullPath) => {
     try {
       shell.showItemInFolder(fullPath);
       return { success: true };
     } catch (error) {
       return { success: false, error: error.message };
     }
   });

   // File system operations
   ipcMain.handle('node-fs-readFile', async (event, filePath) => {
     try {
       return fs.readFileSync(filePath, 'utf8');
     } catch (error) {
       throw new Error(`Failed to read file: ${error.message}`);
     }
   });

   ipcMain.handle('node-fs-writeFile', async (event, filePath, data) => {
     try {
       fs.writeFileSync(filePath, data, 'utf8');
       return true;
     } catch (error) {
       throw new Error(`Failed to write file: ${error.message}`);
     }
   });

   ipcMain.handle('node-fs-exists', async (event, filePath) => {
     try {
       return fs.existsSync(filePath);
     } catch (error) {
       return false;
     }
   });

   ipcMain.handle('node-fs-mkdir', async (event, dirPath, options = {}) => {
     try {
       fs.mkdirSync(dirPath, options);
       return true;
     } catch (error) {
       throw new Error(`Failed to create directory: ${error.message}`);
     }
   });

   ipcMain.handle('node-fs-stat', async (event, filePath) => {
     try {
       const stats = fs.statSync(filePath);
       // Convert fs.Stats to plain object with methods as properties
       return {
         size: stats.size,
         mode: stats.mode,
         mtime: stats.mtime,
         ctime: stats.ctime,
         birthtime: stats.birthtime,
         isFile: stats.isFile(),
         isDirectory: stats.isDirectory(),
         isSymbolicLink: stats.isSymbolicLink(),
         isBlockDevice: stats.isBlockDevice(),
         isCharacterDevice: stats.isCharacterDevice(),
         isFIFO: stats.isFIFO(),
         isSocket: stats.isSocket()
       };
     } catch (error) {
       throw new Error(`Failed to get file stats: ${error.message}`);
     }
   });

   ipcMain.handle('node-fs-readdir', async (event, dirPath) => {
     try {
       return fs.readdirSync(dirPath);
     } catch (error) {
       throw new Error(`Failed to read directory: ${error.message}`);
     }
   });

   ipcMain.handle('node-fs-unlink', async (event, filePath) => {
     try {
       fs.unlinkSync(filePath);
       return true;
     } catch (error) {
       throw new Error(`Failed to delete file: ${error.message}`);
     }
   });

   // Path operations
   ipcMain.handle('node-path-join', async (event, ...paths) => {
     return path.join(...paths);
   });

   ipcMain.handle('node-path-dirname', async (event, filePath) => {
     return path.dirname(filePath);
   });

   ipcMain.handle('node-path-basename', async (event, filePath, ext) => {
     return path.basename(filePath, ext);
   });

   ipcMain.handle('node-path-extname', async (event, filePath) => {
     return path.extname(filePath);
   });

   ipcMain.handle('node-path-resolve', async (event, ...paths) => {
     return path.resolve(...paths);
   });

   // OS operations
   ipcMain.handle('node-os-homedir', async (event) => {
     return os.homedir();
   });

   ipcMain.handle('node-os-tmpdir', async (event) => {
     return os.tmpdir();
   });

   ipcMain.handle('node-os-platform', async (event) => {
     return os.platform();
   });

   ipcMain.handle('node-os-arch', async (event) => {
     return os.arch();
   });

   // HTTP operations
   ipcMain.handle('node-http-get', async (event, url, options = {}) => {
     return new Promise((resolve, reject) => {
       const req = http.get(url, options, (res) => {
         let data = '';
         res.on('data', chunk => data += chunk);
         res.on('end', () => resolve({ statusCode: res.statusCode, data, headers: res.headers }));
       });
       req.on('error', reject);
       req.setTimeout(30000, () => reject(new Error('Request timeout')));
     });
   });

   ipcMain.handle('node-https-get', async (event, url, options = {}) => {
     return new Promise((resolve, reject) => {
       const req = https.get(url, options, (res) => {
         let data = '';
         res.on('data', chunk => data += chunk);
         res.on('end', () => resolve({ statusCode: res.statusCode, data, headers: res.headers }));
       });
       req.on('error', reject);
       req.setTimeout(30000, () => reject(new Error('Request timeout')));
     });
   });

   // Configuration management handlers
   ipcMain.handle('config-get', async (event, section) => {
     try {
       return getConfig(section);
     } catch (error) {
       console.error('Failed to get config:', error);
       throw error;
     }
   });

   ipcMain.handle('config-set', async (event, section, value) => {
     try {
       setConfig(section, value);
       return true;
     } catch (error) {
       console.error('Failed to set config:', error);
       throw error;
     }
   });

   ipcMain.handle('config-get-cloud-service', async (event, serviceType) => {
     try {
       const service = getCloudService(serviceType);
       return service ? service.getDisplayInfo() : null;
     } catch (error) {
       console.error('Failed to get cloud service:', error);
       throw error;
     }
   });

   ipcMain.handle('config-get-cloud-service-full', async (event, serviceType) => {
     try {
       const service = getCloudService(serviceType);
       return service ? service.toConfig() : null;
     } catch (error) {
       console.error('Failed to get full cloud service config:', error);
       throw error;
     }
   });

   ipcMain.handle('config-update-cloud-service', async (event, serviceType, serviceConfig) => {
     try {
       updateCloudService(serviceType, serviceConfig);
       return true;
     } catch (error) {
       console.error('Failed to update cloud service:', error);
       throw error;
     }
   });

   ipcMain.handle('config-get-enabled-cloud-services', async (event) => {
     try {
       return getEnabledCloudServices();
     } catch (error) {
       console.error('Failed to get enabled cloud services:', error);
       throw error;
     }
   });

   ipcMain.handle('config-get-cloud-services-display-info', async (event) => {
     try {
       return getCloudServicesDisplayInfo();
     } catch (error) {
       console.error('Failed to get cloud services display info:', error);
       throw error;
     }
   });

   ipcMain.handle('config-validate-cloud-services', async (event) => {
     try {
       return validateCloudServices();
     } catch (error) {
       console.error('Failed to validate cloud services:', error);
       throw error;
     }
   });

   ipcMain.handle('config-migrate-from-localstorage', async (event, localStorageData) => {
     try {
       await migrateFromLocalStorage(localStorageData);
       return true;
     } catch (error) {
       console.error('Failed to migrate from localStorage:', error);
       throw error;
     }
   });

   ipcMain.handle('config-needs-migration', async (event) => {
     try {
       return needsMigration();
     } catch (error) {
       console.error('Failed to check migration status:', error);
       throw error;
     }
   });

   ipcMain.handle('config-get-path', async (event) => {
     try {
       return getConfigPath();
     } catch (error) {
       console.error('Failed to get config path:', error);
       throw error;
     }
   });

   ipcMain.handle('config-get-hostname', async (event) => {
     try {
       return getHostname();
     } catch (error) {
       console.error('Failed to get hostname:', error);
       throw error;
     }
   });

   ipcMain.handle('config-get-server-url', async (event) => {
     try {
       return getServerUrl();
     } catch (error) {
       console.error('Failed to get server URL:', error);
       throw error;
     }
   });

   ipcMain.handle('config-export', async (event) => {
     try {
       return exportConfig();
     } catch (error) {
       console.error('Failed to export config:', error);
       throw error;
     }
   });
}

module.exports = { setupIpcHandlers }; 