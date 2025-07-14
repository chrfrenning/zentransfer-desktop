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
    getConfig: () => ipcRenderer.invoke('get-config'),
    quit: () => ipcRenderer.invoke('app-quit'),
    log: (message) => ipcRenderer.send('log-to-stdout', message)
  },

  // Dialog APIs
  dialog: {
    showFileDialog: (options) => ipcRenderer.invoke('show-file-dialog', options),
    showDirectoryDialog: () => ipcRenderer.invoke('show-directory-dialog')
  },

  // Upload APIs
  upload: {
    createSession: (sessionData) => ipcRenderer.invoke('create-upload-session', sessionData),
    uploadFile: (fileData, sessionData) => ipcRenderer.invoke('upload-file', fileData, sessionData),
    cancelAll: () => ipcRenderer.invoke('cancel-all-uploads'),
    
    // Upload progress listener
    onProgress: (callback) => {
      const wrappedCallback = (event, progressData) => callback(progressData);
      ipcRenderer.on('upload-progress', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('upload-progress', wrappedCallback);
      };
    }
  },

  // Import APIs
  import: {
    start: (importSettings) => ipcRenderer.invoke('start-import', importSettings),
    cancel: () => ipcRenderer.invoke('cancel-import'),
    
    // Import update listener
    onUpdate: (callback) => {
      const wrappedCallback = (event, data) => callback(data);
      ipcRenderer.on('import-update', wrappedCallback);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('import-update', wrappedCallback);
      };
    },
    
    // Remove all listeners
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('import-update');
    }
  },

  // Download APIs
  download: {
    startMonitoring: () => ipcRenderer.invoke('start-download-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('stop-download-monitoring'),
    getStats: () => ipcRenderer.invoke('get-download-stats'),
    resetSyncTime: (resetTime) => ipcRenderer.invoke('reset-sync-time', resetTime),
    signalUIActivity: () => ipcRenderer.invoke('ui-activity'),
    
    // Download update listener
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
      ipcRenderer.removeAllListeners('download-update');
    }
  },

  // Upload Service APIs
  uploadService: {
    create: (serviceType, settings) => ipcRenderer.invoke('upload-service-create', serviceType, settings),
    test: (serviceType) => ipcRenderer.invoke('upload-service-test', serviceType),
    update: (serviceType, newSettings) => ipcRenderer.invoke('upload-service-update', serviceType, newSettings),
    getDisplayInfo: (serviceType) => ipcRenderer.invoke('upload-service-get-display-info', serviceType),
    createFromPreferences: (preferences) => ipcRenderer.invoke('upload-service-create-from-preferences', preferences),
    getAll: () => ipcRenderer.invoke('upload-service-get-all')
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
    readFileSync: (filePath) => ipcRenderer.sendSync('node-fs-readFileSync', filePath),
    writeFileSync: (filePath, data) => ipcRenderer.sendSync('node-fs-writeFileSync', filePath, data),
    existsSync: (filePath) => ipcRenderer.sendSync('node-fs-existsSync', filePath),
    mkdirSync: (dirPath, options) => ipcRenderer.sendSync('node-fs-mkdirSync', dirPath, options),
    statSync: (filePath) => ipcRenderer.sendSync('node-fs-statSync', filePath),
    readdirSync: (dirPath) => ipcRenderer.sendSync('node-fs-readdirSync', dirPath),
    copyFileSync: (src, dest) => ipcRenderer.sendSync('node-fs-copyFileSync', src, dest),

    // Path operations
    join: (...paths) => ipcRenderer.sendSync('node-path-join', ...paths),
    dirname: (filePath) => ipcRenderer.sendSync('node-path-dirname', filePath),
    basename: (filePath, ext) => ipcRenderer.sendSync('node-path-basename', filePath, ext),
    extname: (filePath) => ipcRenderer.sendSync('node-path-extname', filePath),
    resolve: (...paths) => ipcRenderer.sendSync('node-path-resolve', ...paths),
    
    // OS operations
    homedir: () => ipcRenderer.sendSync('node-os-homedir'),
    tmpdir: () => ipcRenderer.sendSync('node-os-tmpdir'),
    platform: () => ipcRenderer.sendSync('node-os-platform'),
    arch: () => ipcRenderer.sendSync('node-os-arch'),

    // Async file operations
    readFile: (filePath) => ipcRenderer.invoke('node-fs-readFile', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('node-fs-writeFile', filePath, data),
    exists: (filePath) => ipcRenderer.invoke('node-fs-exists', filePath),
    mkdir: (dirPath, options) => ipcRenderer.invoke('node-fs-mkdir', dirPath, options),
    stat: (filePath) => ipcRenderer.invoke('node-fs-stat', filePath),

    // HTTP operations  
    httpGet: (url, options) => ipcRenderer.invoke('node-http-get', url, options),
    httpsGet: (url, options) => ipcRenderer.invoke('node-https-get', url, options),

    // Buffer operations
    bufferFrom: (data, encoding) => ipcRenderer.sendSync('node-buffer-from', data, encoding),
    bufferFromArrayBuffer: (arrayBuffer) => ipcRenderer.sendSync('node-buffer-from-arraybuffer', arrayBuffer)
  },

  // Electron shell API
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell-openExternal', url),
    openPath: (path) => ipcRenderer.invoke('shell-openPath', path),
    showItemInFolder: (fullPath) => ipcRenderer.invoke('shell-showItemInFolder', fullPath)
  },

  // Configuration management APIs
  config: {
    get: (section) => ipcRenderer.invoke('config-get', section),
    set: (section, value) => ipcRenderer.invoke('config-set', section, value),
    getCloudService: (serviceType) => ipcRenderer.invoke('config-get-cloud-service', serviceType),
    getCloudServiceFull: (serviceType) => ipcRenderer.invoke('config-get-cloud-service-full', serviceType),
    updateCloudService: (serviceType, serviceConfig) => ipcRenderer.invoke('config-update-cloud-service', serviceType, serviceConfig),
    getEnabledCloudServices: () => ipcRenderer.invoke('config-get-enabled-cloud-services'),
    getCloudServicesDisplayInfo: () => ipcRenderer.invoke('config-get-cloud-services-display-info'),
    validateCloudServices: () => ipcRenderer.invoke('config-validate-cloud-services'),
    migrateFromLocalStorage: (localStorageData) => ipcRenderer.invoke('config-migrate-from-localstorage', localStorageData),
    needsMigration: () => ipcRenderer.invoke('config-needs-migration'),
    getConfigPath: () => ipcRenderer.invoke('config-get-path'),
    getHostname: () => ipcRenderer.invoke('config-get-hostname'),
    getServerUrl: () => ipcRenderer.invoke('config-get-server-url'),
    exportConfig: () => ipcRenderer.invoke('config-export')
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// For development: also expose a flag to indicate preload script loaded
contextBridge.exposeInMainWorld('electronPreloadLoaded', true);

console.log('Preload script loaded successfully - APIs exposed via window.electronAPI'); 