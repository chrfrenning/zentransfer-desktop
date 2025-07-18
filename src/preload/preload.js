/**
 * Preload Script
 * Secure bridge between main and renderer processes
 * Exposes limited, safe APIs to the renderer through contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // App and system APIs
  app: {
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    getIsDevelopmentMode: () => ipcRenderer.invoke('get-app-devmode'),
    getServerUrl: () => ipcRenderer.invoke('get-server-url'),
    doVersionCheck: () => ipcRenderer.invoke('do-version-check'),
    quit: () => ipcRenderer.invoke('app-quit'),
    
    // Enhanced logging API
    log: (level, message, meta = {}) => ipcRenderer.send('log-from-renderer', { level, message, meta }),
    
    // Log management APIs
    showLogsFolder: () => ipcRenderer.invoke('show-logs-folder'),
    getLogInfo: () => ipcRenderer.invoke('get-log-info')
  },

  config: {
    get: (section) => ipcRenderer.invoke('config-get', section),
    set: (section, value) => ipcRenderer.invoke('config-set', section, value),
    getCloudSettings: (serviceType) => ipcRenderer.invoke('config-get-cloud-settings', serviceType),
    updateCloudSettings: (serviceType, settings) => ipcRenderer.send('config-update-cloud-settings', serviceType, settings),
    getUrls: () => ipcRenderer.invoke('config-get-urls')
  },

  auth: {
    hasValidToken: () => ipcRenderer.invoke('auth-has-valid-token'),
    getToken: () => ipcRenderer.invoke('auth-get-token'),
    getEmail: () => ipcRenderer.invoke('auth-get-email'),
    initializeLogin: (email) => ipcRenderer.invoke('auth-initialize-login', email),
    finalizeLogin: (otp) => ipcRenderer.invoke('auth-finalize-login', otp),
    validateConnection: () => ipcRenderer.invoke('auth-validate-connection'),
    logout: () => ipcRenderer.invoke('auth-logout'),
  },

  clouds: {
    getServices: () => ipcRenderer.invoke('clouds-get-services'),
    getEnabledServices: () => ipcRenderer.invoke('clouds-get-enabled-services'),
    getAwsRegions: () => ipcRenderer.invoke('clouds-get-aws-regions')
  },

  // Dialog APIs
  dialog: {
    showFileDialog: (options) => ipcRenderer.invoke('show-file-dialog', options),
    showDirectoryDialog: () => ipcRenderer.invoke('show-directory-dialog')
  },

  // Upload APIs
  upload: {
    // Upload queue methods
    addToQueue: (files) => ipcRenderer.invoke('upload-add-file', files),
    cancelJob: (jobId) => ipcRenderer.invoke('upload-cancel-job', jobId),
    cancelAll: () => ipcRenderer.invoke('upload-cancel-all'),
    getQueueStats: () => ipcRenderer.invoke('upload-get-stats'),
    
    // Upload progress listener
    onProgress: (callback) => {
      const wrappedCallback = (event, progressData) => callback(progressData);
      ipcRenderer.on('upload-progress', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('upload-progress', wrappedCallback);
      };
    },
    
    // Upload update listener (for queue updates)
    onUpdate: (callback) => {
      const wrappedCallback = (event, data) => callback(data);
      ipcRenderer.on('upload-update', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('upload-update', wrappedCallback);
      };
    }
  },

  // Import APIs
  import: {
    start: (source) => ipcRenderer.invoke('import-start', source),
    cancel: () => ipcRenderer.invoke('import-cancel'),
    getQueueStats: () => ipcRenderer.invoke('import-get-stats'),
    
    // Import update listener
    onUpdate: (callback) => {
      const wrappedCallback = (event, data) => callback(data);
      ipcRenderer.on('import-update', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('import-update', wrappedCallback);
      };
    },
    
    onComplete: (callback) => {
      const wrappedCallback = (event, data) => callback(data);
      ipcRenderer.on('import-complete', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('import-complete', wrappedCallback);
      };
    }
  },

  // Download APIs
  download: {
    startMonitoring: () => ipcRenderer.invoke('start-download-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('stop-download-monitoring'),
    getStats: () => ipcRenderer.invoke('get-download-stats'),
    resetSyncTime: (resetTime) => ipcRenderer.invoke('reset-sync-time', resetTime),
    signalUIActivity: () => ipcRenderer.invoke('ui-activity-signal'),
    
    // Download progress listener
    onProgress: (callback) => {
      const wrappedCallback = (event, progressData) => callback(progressData);
      ipcRenderer.on('download-progress', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('download-progress', wrappedCallback);
      };
    },
    
    // Download completed listener
    onCompleted: (callback) => {
      const wrappedCallback = (event, completedData) => callback(completedData);
      ipcRenderer.on('download-completed', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('download-completed', wrappedCallback);
      };
    },
    
    // Download error listener
    onError: (callback) => {
      const wrappedCallback = (event, errorData) => callback(errorData);
      ipcRenderer.on('download-error', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('download-error', wrappedCallback);
      };
    },
    
    // Download monitoring started listener
    onMonitoringStarted: (callback) => {
      const wrappedCallback = (event) => callback();
      ipcRenderer.on('download-monitoring-started', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('download-monitoring-started', wrappedCallback);
      };
    },
    
    // Download monitoring stopped listener
    onMonitoringStopped: (callback) => {
      const wrappedCallback = (event) => callback();
      ipcRenderer.on('download-monitoring-stopped', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('download-monitoring-stopped', wrappedCallback);
      };
    },
    
    // Download update listener (legacy, keeping for compatibility)
    onUpdate: (callback) => {
      const wrappedCallback = (event, updateData) => callback(updateData);
      ipcRenderer.on('download-update', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('download-update', wrappedCallback);
      };
    },
    
    // Remove all listeners
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('download-progress');
      ipcRenderer.removeAllListeners('download-completed');
      ipcRenderer.removeAllListeners('download-error');
      ipcRenderer.removeAllListeners('download-monitoring-started');
      ipcRenderer.removeAllListeners('download-monitoring-stopped');
      ipcRenderer.removeAllListeners('download-update');
    }
  },

  // Auto-updater APIs
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    
    // Update status listener
    onStatus: (callback) => {
      const wrappedCallback = (event, { status, data }) => callback(status, data);
      ipcRenderer.on('update-status', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('update-status', wrappedCallback);
      };
    }
  },

  // Node.js operations through main process (synchronous versions)
  node: {
    // File system operations
    // readFileSync: (filePath) => ipcRenderer.sendSync('node-fs-readFileSync', filePath),
    // writeFileSync: (filePath, data) => ipcRenderer.sendSync('node-fs-writeFileSync', filePath, data),
    // existsSync: (filePath) => ipcRenderer.sendSync('node-fs-existsSync', filePath),
    // mkdirSync: (dirPath, options) => ipcRenderer.sendSync('node-fs-mkdirSync', dirPath, options),
    // statSync: (filePath) => ipcRenderer.sendSync('node-fs-statSync', filePath),
    // readdirSync: (dirPath) => ipcRenderer.sendSync('node-fs-readdirSync', dirPath),
    // copyFileSync: (src, dest) => ipcRenderer.sendSync('node-fs-copyFileSync', src, dest),
    // unlinkSync: (filePath) => ipcRenderer.sendSync('node-fs-unlinkSync', filePath),

    // Async file operations
    // readFile: (filePath) => ipcRenderer.invoke('node-fs-readFile', filePath),
    // writeFile: (filePath, data) => ipcRenderer.invoke('node-fs-writeFile', filePath, data),
    // exists: (filePath) => ipcRenderer.invoke('node-fs-exists', filePath),
    // mkdir: (dirPath, options) => ipcRenderer.invoke('node-fs-mkdir', dirPath, options),
    // stat: (filePath) => ipcRenderer.invoke('node-fs-stat', filePath),
    // readdir: (dirPath) => ipcRenderer.invoke('node-fs-readdir', dirPath),
    // copyFile: (src, dest) => ipcRenderer.invoke('node-fs-copyFile', src, dest),
    // unlink: (filePath) => ipcRenderer.invoke('node-fs-unlink', filePath),

    // Path operations
    // join: (...paths) => ipcRenderer.sendSync('node-path-join', ...paths),
    // dirname: (filePath) => ipcRenderer.sendSync('node-path-dirname', filePath),
    // basename: (filePath, ext) => ipcRenderer.sendSync('node-path-basename', filePath, ext),
    // extname: (filePath) => ipcRenderer.sendSync('node-path-extname', filePath),
    // resolve: (...paths) => ipcRenderer.sendSync('node-path-resolve', ...paths),
    
    // OS operations
    // homedir: () => ipcRenderer.sendSync('node-os-homedir'),
    // tmpdir: () => ipcRenderer.sendSync('node-os-tmpdir'),
    platform: () => ipcRenderer.sendSync('node-os-platform'),
    arch: () => ipcRenderer.sendSync('node-os-arch'),

    // HTTP operations  
    // httpGet: (url, options) => ipcRenderer.invoke('node-http-get', url, options),
    httpsGet: (url, options) => ipcRenderer.invoke('node-https-get', url, options),

    // Buffer operations
    bufferFrom: (data, encoding) => ipcRenderer.sendSync('node-buffer-from', data, encoding),
    bufferFromArrayBuffer: (arrayBuffer) => ipcRenderer.sendSync('node-buffer-from-arraybuffer', arrayBuffer)
  },

  // Electron shell API
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell-open-external', url),
    //openPath: (path) => ipcRenderer.invoke('shell-open-path', path),
    showItemInFolder: (fullPath) => ipcRenderer.invoke('shell-show-item-in-folder', fullPath)
  },

  // Utility APIs
  utility: {
    estimatePOWPerformance: (bits) => ipcRenderer.invoke('estimate-pow-performance', bits),
    getLastUsedDestinationFolders: () => ipcRenderer.invoke('get-last-used-destination-folders'),
    getLastUsedSourceFolders: () => ipcRenderer.invoke('get-last-used-source-folders'),
    rememberDestinationFolder: (folder) => ipcRenderer.invoke('remember-destination-folder', folder),
    rememberSourceFolder: (folder) => ipcRenderer.invoke('remember-source-folder', folder)
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// For development: also expose a flag to indicate preload script loaded
contextBridge.exposeInMainWorld('electronPreloadLoaded', true);

console.log('Preload script loaded successfully - APIs exposed via window.electronAPI'); 