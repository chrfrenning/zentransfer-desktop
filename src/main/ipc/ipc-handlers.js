/**
 * IPC Handlers
 * Sets up Inter-Process Communication handlers between main and renderer processes
 * Extracted from main.js for better modularity
 */

const { ipcMain, dialog, app } = require('electron');
const { autoUpdater } = require('electron-updater');

// Import shared configuration
const sharedConfig = require('../../shared/config.js');

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
  ipcMain.handle('start-download-monitoring', async (event, downloadPath, lastSyncTime, authToken) => {
    try {
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
       console.log(`Reset sync time to: ${syncTime}, cleared latest downloaded file time`);
       return { success: true };
     } catch (error) {
       console.error('Failed to reset sync time:', error);
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
}

module.exports = { setupIpcHandlers }; 