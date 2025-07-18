/**
 * IPC Handlers
 * Sets up Inter-Process Communication handlers between main and renderer processes
 * Extracted from main.js for better modularity
 */

const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const { ipcMain, dialog, app, BrowserWindow, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const logger = require('../utils/Logger.js');
const { awsLoadRegions } = require('../services/AWSRegions.js');
const { CloudFactory } = require('../services/CloudFactory.js');
const { estimatePOWPerformance } = require('../utils/EstimatePowPerformance.js');

function setupIpcHandlers(uploadWorkerPool, importWorkerPool, downloadWorkerPool) {
  logger.info('Setting up IPC handlers...');

  /*
   * App and system APIs
   *
   */

  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  ipcMain.handle('get-app-devmode', async () => {
    return app.isDevelopmentMode;
  });

  ipcMain.handle('get-server-url', async () => {
    return app.globals.serverBaseUrl;
  });

  ipcMain.handle('do-version-check', async () => {
    return { 
      status: 'VersionCheckStatus.OK', 
      message: null, 
      maintenance_until: null 
    };
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

  ipcMain.on('log-from-renderer', (event, { level, message, meta = {} }) => {
    meta.process = 'renderer';
    logger[level](`${message}`, meta);
  });

  ipcMain.handle('show-logs-folder', async () => {
    try {
      const logInfo = logger.getLogInfo();
      if (!logInfo) {
        logger.error('Cannot show logs folder: log info not available');
        return { success: false, error: 'Log information not available' };
      }

      // This opens the folder and highlights the log file
      shell.showItemInFolder(logInfo.path);
      
      logger.info('User opened logs folder via IPC');
      return { success: true };
    } catch (error) {
      logger.error('Failed to open logs folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-log-info', async () => {
    try {
      const logInfo = logger.getLogInfo();
      if (logInfo) {
        logger.debug('Provided log info to renderer');
        return logInfo;
      } else {
        logger.warn('Log info requested but not available');
        return null;
      }
    } catch (error) {
      logger.error('Failed to get log info:', error);
      return null;
    }
  });



  /*
   * Configuration APIs
   *
   */

  ipcMain.handle('config-get', async (event, section) => {
    logger.silly(`Getting config: ${section}`);
    return app.configurationManager.get(section);
  });

  ipcMain.handle('config-set', async (event, section, value) => {
    logger.silly(`Setting config: ${section} = ${value}`);
    app.configurationManager.set(section, value);
  });

  ipcMain.handle('config-get-cloud-settings', async (event, serviceType) => {
    return app.configurationManager.getCloudService(serviceType);
  });

  ipcMain.on('config-update-cloud-settings', async (event, serviceType, settings) => {
    app.configurationManager.updateCloudService(serviceType, settings);
  });

  ipcMain.handle('config-get-urls', async (event) => {
    return app.globals.urls;
  });



  /*
   * Authentication APIs
   *
   */

  ipcMain.handle('auth-has-valid-token', async (event) => {
    const token = await app.tokenManager.getToken();
    return token && !app.tokenManager.isTokenExpired(token);
  });

  ipcMain.handle('auth-get-token', async (event) => {
    return app.tokenManager.getToken();
  });

  ipcMain.handle('auth-get-email', async (event) => {
    return app.configurationManager.get('email');
  });

  ipcMain.handle('auth-initialize-login', async (event, email) => {
    try {
      const deviceId = app.configurationManager.get('deviceId');
      const result = await app.authenticationService.initialize(email, deviceId);

      if ( result.result === 'ok' ) {
        logger.info('Login initialized successfully, sessionId: ' + result.session_id);
        app.configurationManager.set('sessionId', result.session_id);
        app.configurationManager.set('email', email);
        app.configurationManager.saveConfiguration();
        return true;
      }

    } catch (error) {
      logger.error('Failed to initialize login:', error);
    }

    return false;
  });

  ipcMain.handle('auth-finalize-login', async (event, otp) => {
    try {
      const sessionId = app.configurationManager.get('sessionId');
      logger.info(`Finalizing login for sessionId: ${sessionId} and otp: ${otp}`);

      const result = await app.authenticationService.finalize(sessionId, otp);
      if ( result.result === 'ok' ) {
        app.tokenManager.saveToken(result.token, result.email);
        return true;
      }
    } catch (error) {
      logger.error('Failed to finalize login:', error);
    }

    return false;
  });

  ipcMain.handle('auth-validate-connection', async (event) => {
    try {
      const result = await app.authenticationService.testConnection();
      return result.result === 'ok';
    } catch (error) {
      logger.error('Failed to validate connection:', error);
    }

    return false;
  });

  ipcMain.handle('auth-logout', async (event) => {
    // TODO: We should let the server know that we're logging out
    await app.tokenManager.clearToken();
    return true;
  });




  /*
   * Cloud services APIs
   *
   */
  
  ipcMain.handle('clouds-get-services', async (event) => {
    return CloudFactory.listCloudServices();
  });
  
  ipcMain.handle('clouds-get-enabled-services', async (event) => {
    let enabledServices = [];

    if (app.tokenManager.getValidToken()) {
      enabledServices.push({
        serviceType: 'zentransfer',
        enabled: true
      });
    }

    for (const serviceType of CloudFactory.listCloudServices()) {
      const service = app.configurationManager.getCloudService(serviceType);
      if (service && service.enabled) {
        enabledServices.push({
          serviceType: serviceType,
          enabled: true
        });
      }
    }

    logger.debug('Enabled services:', enabledServices);
    return enabledServices;
  });

  ipcMain.handle('clouds-get-aws-regions', async (event) => {
    return awsLoadRegions();
  });



  /*
   * File selection and folder browsing dialogs
   *
   */
  
  // Handle directory dialog requests
  ipcMain.handle('show-directory-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Directory'
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



  /*
   * Upload queue and management
   *
   */
  
  ipcMain.handle('upload-add-file', async (event, files) => {
    try {
      const results = await uploadWorkerPool.addFilesToQueue(files);
      return { success: true, results };
    } catch (error) {
      console.error('Failed to add files to upload queue:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('upload-cancel-job', async (event, jobId) => {
    try {
      uploadWorkerPool.cancelJob(jobId);
      return { success: true };
    } catch (error) {
      console.error('Failed to cancel job:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('upload-cancel-all', async () => {
    try {
      uploadWorkerPool.cancelAllJobs();
      return { success: true };
    } catch (error) {
      console.error('Failed to cancel uploads:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('upload-get-stats', async () => {
    try {
      const stats = uploadWorkerPool.getStats();
      return { success: true, stats };
    } catch (error) {
      console.error('Failed to get upload queue stats:', error);
      return { success: false, error: error.message };
    }
  });



  /*
   * Import jobs
   *
   */
  
  ipcMain.handle('import-start', async (event, source) => {
    try {
      return await importWorkerPool.startImport(source.path);
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  });
  
  ipcMain.handle('import-cancel', async (event) => {
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
  
  ipcMain.handle('import-get-stats', async () => {
    return importWorkerPool.getStats();
  });



  /*
   * Download queue and management
   *
   */
  
  ipcMain.handle('start-download-monitoring', async (event) => {
    try {

      if ( !app.configurationManager.get('downloadSettings.downloadPath') ) {
        return false;
      }
      
      app.downloadWorkerPool.startMonitoring();
      return true;
      
    } catch (error) {
      console.error('Download monitoring failed:', error);
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
  
   ipcMain.handle('get-download-queue-length', async () => {
     return downloadWorkerPool.getQueueLength();
   });
   
   // Reset sync time
   ipcMain.handle('reset-sync-time', async (event) => {
     try {
       app.downloadWorkerPool.resetSyncTime();
     } catch (error) {
       console.error('Failed to reset sync time:', error);
       return false;
     }
   });

   ipcMain.handle('get-last-sync-time', async () => {
    return app.downloadWorkerPool.getLastSyncTime();
   });
   
   // Reset server polling backoff on UI activity
   ipcMain.handle('ui-activity-signal', async (event) => {
     app.downloadWorkerPool.onUserActivitySignal();
   });



   /*
    * Auto-update handlers
    *
    */
   
   ipcMain.handle('check-for-updates', async () => {
     try {
       //const result = await autoUpdater.checkForUpdates();
       
       return { 
        status: 'ok',
        maintenanceUntil: null,
        message: null,
        latestVersion: null
        };

     } catch (error) {

       console.error('Failed to check for updates:', error);
       
       return { 
        status: 'ok',
        maintenanceUntil: null,
        message: null,
        latestVersion: null
        };

     }
   });
   
   ipcMain.handle('download-update', async () => {
     try {
       await autoUpdater.downloadUpdate();
       return true;
     } catch (error) {
       console.error('Failed to download update:', error);
       return false;
     }
   });
   
   ipcMain.handle('quit-and-install', async () => {
     try {
       autoUpdater.quitAndInstall();
       return true;
     } catch (error) {
       console.error('Failed to quit and install:', error);
       return false;
     }
   });



   /*
    * File system operations (sync)
    *
    */

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

   ipcMain.handle('node-fs-unlinkSync', async (event, filePath) => {
     try {
       fs.unlinkSync(filePath);
       return true;
     } catch (error) {
       throw new Error(`Failed to delete file: ${error.message}`);
     }
   });



   /*
    * File system operations (async)
    *
    */

   ipcMain.handle('node-fs-readFile', async (event, filePath) => {
    try {
      return fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  });

  ipcMain.handle('node-fs-writeFile', async (event, filePath, data) => {
    try {
      return fs.writeFile(filePath, data, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  });

  ipcMain.handle('node-fs-exists', async (event, filePath) => {
    try {
      return fs.exists(filePath);
    } catch (error) {
      throw new Error(`Failed to check if file exists: ${error.message}`);
    }
  });

  ipcMain.handle('node-fs-mkdir', async (event, dirPath, options = {}) => {
    try {
      return fs.mkdir(dirPath, options);
    } catch (error) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  });

  ipcMain.handle('node-fs-stat', async (event, filePath) => {
    try {
      return fs.stat(filePath);
    } catch (error) {
      throw new Error(`Failed to get file stats: ${error.message}`);
    }
  });

  ipcMain.handle('node-fs-readdir', async (event, dirPath) => {
    try {
      return fs.readdir(dirPath);
    } catch (error) {
      throw new Error(`Failed to read directory: ${error.message}`);
    }
  });

  ipcMain.handle('node-fs-copyFile', async (event, src, dest) => {
    try {
      return fs.copyFile(src, dest);
    } catch (error) {
      throw new Error(`Failed to copy file: ${error.message}`);
    }
  });

  ipcMain.handle('node-fs-unlink', async (event, filePath) => {
    try {
      return fs.unlink(filePath);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  });



  /*
   * Path operations
   *
   */

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



   /*
    * OS operations
    *
    */

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



   /*
    * HTTP operations
    *
    */

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



   /*
    * Buffer operations
    *
    */

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



   /*
    * Shell operations
    *
    */
   
   ipcMain.handle('shell-open-external', async (event, url) => {
     try {
       await shell.openExternal(url);
       return { success: true };
     } catch (error) {
       return { success: false, error: error.message };
     }
   });

   ipcMain.handle('shell-open-path', async (event, path) => {
     try {
       const result = await shell.openPath(path);
       return { success: true, result };
     } catch (error) {
       return { success: false, error: error.message };
     }
   });

   ipcMain.handle('shell-show-item-in-folder', async (event, fullPath) => {
     try {
       shell.showItemInFolder(fullPath);
       return { success: true };
     } catch (error) {
       return { success: false, error: error.message };
     }
   });



   /*
    * Utility operations
    *
    */

   ipcMain.handle('estimate-pow-performance', async (event, bits) => {
    return estimatePOWPerformance(bits);
   });

   ipcMain.handle('get-last-used-destination-folders', async (event) => {
    return app.configurationManager.get('lastUsedFolders.destinationFolders');
   });

   ipcMain.handle('get-last-used-source-folders', async (event) => {
    return app.configurationManager.get('lastUsedFolders.sourceFolders');
   });

   ipcMain.handle('remember-destination-folder', async (event, folder) => {
    let lastUsedFolders = app.configurationManager.get('lastUsedFolders.destinationFolders');
    if (!lastUsedFolders.includes(folder)) {
      if (lastUsedFolders.length >= 10) {
        lastUsedFolders.shift();
      }
      lastUsedFolders.push(folder);
    }

    app.configurationManager.set('lastUsedFolders.destinationFolders', lastUsedFolders);
    app.configurationManager.saveConfiguration();
   });

   ipcMain.handle('remember-source-folder', async (event, folder) => {
    let lastUsedFolders = app.configurationManager.get('lastUsedFolders.sourceFolders');
    if (!lastUsedFolders.includes(folder)) {
      if (lastUsedFolders.length >= 10) {
        lastUsedFolders.shift();
      }
      lastUsedFolders.push(folder);
    }
   });
}

module.exports = { setupIpcHandlers }; 