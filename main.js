const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Import shared configuration
const sharedConfig = require('./src/config/shared-config.js');

// Configure auto-updater
autoUpdater.checkForUpdatesAndNotify();

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
  sendUpdateStatusToRenderer('checking-for-update');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  sendUpdateStatusToRenderer('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
  sendUpdateStatusToRenderer('update-not-available', info);
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err);
  sendUpdateStatusToRenderer('error', { message: err.message });
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`Download progress: ${progressObj.percent}%`);
  sendUpdateStatusToRenderer('download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  sendUpdateStatusToRenderer('update-downloaded', info);
  
  // Show dialog to user asking if they want to restart and install
  dialog.showMessageBox({
    type: 'info',
    title: 'Update ready',
    message: 'Update downloaded. The application will restart to apply the update.',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// Helper function to send update status to renderer
function sendUpdateStatusToRenderer(status, data = null) {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('update-status', { status, data });
  });
}

// Use shared config instead of getConfig function
const getConfig = () => sharedConfig;

// Enable live reload for Electron in development
if (sharedConfig.isDevelopment || process.argv.includes('--dev')) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
    // Ignore node_modules and hidden files
    ignored: /node_modules|[\/\\]\./
  });
}

// Upload Worker Pool
class UploadWorkerPool {
  constructor(poolSize = 3) {
    this.workers = [];
    this.queue = [];
    this.activeJobs = new Map();
    this.jobIdCounter = 0;
    
    // Create worker pool
    for (let i = 0; i < poolSize; i++) {
      this.createWorker(i);
    }
    
    console.log(`Upload worker pool initialized with ${poolSize} workers`);
  }
  
  createWorker(id) {
    console.log(`Creating upload worker ${id}...`);
    const workerPath = path.join(__dirname, 'workers', 'upload-worker.js');
    console.log(`Worker path: ${workerPath}`);
    
    const worker = new Worker(workerPath, {
      workerData: { workerId: id }
    });
    
    worker.on('message', (message) => {
      this.handleWorkerMessage(worker, message);
    });
    
    worker.on('error', (error) => {
      console.error(`Upload worker ${id} error:`, error);
      this.handleWorkerError(worker, error);
    });
    
    worker.on('exit', (code) => {
      console.log(`Upload worker ${id} exited with code ${code}`);
      if (code !== 0) {
        console.error(`Upload worker ${id} stopped with exit code ${code}`);
        // Recreate worker
        setTimeout(() => {
          this.createWorker(id);
        }, 1000);
      }
    });
    
    this.workers.push({
      worker,
      id,
      busy: false,
      currentJob: null
    });
    
    console.log(`Upload worker ${id} created successfully`);
  }
  
  async execute(jobData) {
    return new Promise((resolve, reject) => {
      const jobId = ++this.jobIdCounter;
      const job = {
        id: jobId,
        data: jobData,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      const availableWorker = this.workers.find(w => !w.busy);
      
      if (availableWorker) {
        this.assignJob(availableWorker, job);
      } else {
        this.queue.push(job);
      }
    });
  }
  
  assignJob(workerInfo, job) {
    workerInfo.busy = true;
    workerInfo.currentJob = job;
    this.activeJobs.set(job.id, { workerInfo, job });
    
    workerInfo.worker.postMessage({
      type: job.data.type,
      jobId: job.id,
      ...job.data
    });
  }
  
  handleWorkerMessage(worker, message) {
    const { type, jobId } = message;
    
    if (type === 'progress') {
      // Forward progress updates to renderer
      this.sendProgressUpdate(message);
      return;
    }
    
    if (type === 'result' || type === 'error') {
      const jobInfo = this.activeJobs.get(jobId);
      if (!jobInfo) return;
      
      const { workerInfo, job } = jobInfo;
      
      // Free up worker
      workerInfo.busy = false;
      workerInfo.currentJob = null;
      this.activeJobs.delete(jobId);
      
      // Resolve job
      if (type === 'error') {
        job.reject(new Error(message.error));
      } else {
        job.resolve(message.result);
      }
      
      // Process next job in queue
      if (this.queue.length > 0) {
        const nextJob = this.queue.shift();
        this.assignJob(workerInfo, nextJob);
      }
    }
  }
  
  handleWorkerError(worker, error) {
    // Find jobs assigned to this worker and reject them
    for (const [jobId, { workerInfo, job }] of this.activeJobs) {
      if (workerInfo.worker === worker) {
        job.reject(error);
        this.activeJobs.delete(jobId);
        workerInfo.busy = false;
        workerInfo.currentJob = null;
      }
    }
  }
  
  sendProgressUpdate(progressData) {
    // Send progress update to all renderer processes
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('upload-progress', progressData);
    });
  }
  
  getStats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      queueLength: this.queue.length,
      activeJobs: this.activeJobs.size
    };
  }

  cancelAllJobs() {
    console.log('Cancelling all upload jobs...');
    
    // Cancel all active jobs
    for (const [jobId, { workerInfo, job }] of this.activeJobs) {
      // Send cancel message to worker
      workerInfo.worker.postMessage({
        type: 'cancel',
        jobId: jobId
      });
      
      // Reject the job promise
      job.reject(new Error('Upload cancelled by user'));
      
      // Free up worker
      workerInfo.busy = false;
      workerInfo.currentJob = null;
    }
    
    // Clear all active jobs
    this.activeJobs.clear();
    
    // Clear queue
    for (const job of this.queue) {
      job.reject(new Error('Upload cancelled by user'));
    }
    this.queue = [];
    
    console.log('All upload jobs cancelled');
  }
}

// Global upload worker pool
let uploadWorkerPool;

// Simple Import Worker Manager
class ImportWorkerManager {
  constructor() {
    this.worker = null;
    this.isImporting = false;
    this.currentResolve = null;
    this.currentReject = null;
    
    console.log('Import worker manager initialized');
  }
  
  createWorker() {
    if (this.worker) {
      console.log('Import worker already exists');
      return;
    }
    
    console.log('Creating import worker...');
    const workerPath = path.join(__dirname, 'workers', 'import-worker-main.js');
    
    this.worker = new Worker(workerPath, {
      workerData: { workerId: 0 }
    });
    
    this.worker.on('message', (message) => {
      this.handleWorkerMessage(message);
    });
    
    this.worker.on('error', (error) => {
      console.error('Import worker error:', error);
      this.handleWorkerError(error);
    });
    
    this.worker.on('exit', (code) => {
      console.log(`Import worker exited with code ${code}`);
      this.worker = null;
      this.isImporting = false;
    });
    
    console.log('Import worker created successfully');
  }
  
  async startImport(importSettings) {
    if (this.isImporting) {
      throw new Error('Import already in progress');
    }
    
    this.createWorker();
    this.isImporting = true;
    
    return new Promise((resolve, reject) => {
      this.currentResolve = resolve;
      this.currentReject = reject;
      
      this.worker.postMessage({
        type: 'start-import',
        importSettings
      });
    });
  }
  
  stopImport() {
    console.log(`Stopping import... isImporting: ${this.isImporting}, worker exists: ${!!this.worker}`);
    
    // Always send cancel message to worker if it exists, regardless of isImporting flag
    if (this.worker) {
      console.log('Sending cancel-import message to worker');
      this.worker.postMessage({
        type: 'cancel-import'
      });
    } else {
      console.log('No worker to send cancel message to');
    }
    
    // Don't set isImporting to false here - let the worker response handle it
  }
  
  handleWorkerMessage(message) {
    const { type } = message;
    
    console.log('Import worker message:', type);
    
    if (type === 'progress' || type === 'log') {
      // Forward progress and log updates to renderer
      this.sendImportUpdate(message);
      return;
    }
    
    if (type === 'upload-ready') {
      // Handle upload queue from import
      this.handleUploadReady(message);
      return;
    }
    
    if (type === 'completed') {
      this.isImporting = false;
      this.sendImportUpdate(message);
      if (this.currentResolve) {
        this.currentResolve(message.result);
        this.currentResolve = null;
        this.currentReject = null;
      }
    }
    
    if (type === 'error') {
      this.isImporting = false;
      this.sendImportUpdate(message);
      if (this.currentReject) {
        this.currentReject(new Error(message.error));
        this.currentResolve = null;
        this.currentReject = null;
      }
    }
    
    if (type === 'cancelled') {
      this.isImporting = false;
      this.sendImportUpdate(message);
      if (this.currentResolve) {
        this.currentResolve({ status: 'cancelled' });
        this.currentResolve = null;
        this.currentReject = null;
      }
    }
  }
  
  handleUploadReady(message) {
    const { filePaths, count, importSettings } = message;
    console.log(`Import worker: ${count} files ready for upload`);
    
    // Determine which upload services are enabled
    const uploadServices = [];
    
    if (importSettings?.uploadToZenTransfer) {
      uploadServices.push({ type: 'zentransfer', name: 'ZenTransfer' });
    }
    
    if (importSettings?.uploadToAwsS3) {
      uploadServices.push({ type: 'aws-s3', name: 'AWS S3' });
    }
    
    if (importSettings?.uploadToAzure) {
      uploadServices.push({ type: 'azure-blob', name: 'Azure Blob Storage' });
    }
    
    if (importSettings?.uploadToGcp) {
      uploadServices.push({ type: 'gcp-storage', name: 'Google Cloud Storage' });
    }
    
    console.log(`Upload services enabled: ${uploadServices.map(s => s.name).join(', ')}`);
    
    // Forward to renderer for upload manager integration
    this.sendImportUpdate({
      type: 'upload-ready',
      filePaths,
      count,
      uploadServices,
      importSettings  // Pass import settings to renderer
    });
  }
  
  handleWorkerError(error) {
    console.error('Import worker error:', error);
    this.isImporting = false;
    if (this.currentReject) {
      this.currentReject(error);
      this.currentResolve = null;
      this.currentReject = null;
    }
  }
  
  sendImportUpdate(updateData) {
    // Send import update to all renderer processes
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('import-update', updateData);
    });
  }
}

// Global import worker pool
let importWorkerPool;

// Upload Service Manager
const { UploadServiceManager } = require(path.join(__dirname, 'workers', 'upload-service-manager.js'));
let uploadServiceManager;

// Download Worker Manager
class DownloadWorkerManager {
  constructor() {
    this.workers = [];
    this.downloadQueue = []; // Files waiting to be downloaded
    this.activeJobs = new Map(); // Currently downloading files
    this.completedFiles = []; // Successfully downloaded files
    this.failedFiles = []; // Failed downloads
    this.jobIdCounter = 0;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.lastSyncTime = null;
    this.latestDownloadedFileTime = null;
    this.downloadPath = null;
    this.authToken = null;
    this.maxCompletedItems = 20; // Maximum completed items to keep
    
    // Create 3 download workers
    for (let i = 0; i < 3; i++) {
      this.createWorker(i);
    }
    
    console.log('Download worker manager initialized with 3 workers');
  }
  
  createWorker(id) {
    console.log(`Creating download worker ${id}...`);
    const workerPath = path.join(__dirname, 'workers', 'download-worker-main.js');
    
    const worker = new Worker(workerPath, {
      workerData: { workerId: id }
    });
    
    worker.on('message', (message) => {
      this.handleWorkerMessage(worker, message);
    });
    
    worker.on('error', (error) => {
      console.error(`Download worker ${id} error:`, error);
      this.handleWorkerError(worker, error);
    });
    
    worker.on('exit', (code) => {
      console.log(`Download worker ${id} exited with code ${code}`);
      if (code !== 0) {
        console.error(`Download worker ${id} stopped with exit code ${code}`);
        // Recreate worker
        setTimeout(() => {
          this.createWorker(id);
        }, 1000);
      }
    });
    
    this.workers.push({
      worker,
      id,
      busy: false,
      currentJob: null
    });
    
    console.log(`Download worker ${id} created successfully`);
  }
  
  async startMonitoring(downloadPath, lastSyncTime = null, authToken = null) {
    if (this.isMonitoring) {
      throw new Error('Monitoring already in progress');
    }
    
    this.isMonitoring = true;
    this.downloadPath = downloadPath;
    this.lastSyncTime = lastSyncTime || '2025-01-01T00:00:00.000Z';
    this.authToken = authToken;
    
    console.log(`Starting download monitoring with sync time: ${this.lastSyncTime}`);
    
    if (!this.authToken) {
      console.warn('No authentication token provided for download monitoring');
    }
    
    // Start monitoring interval (check every 30 seconds to be respectful to server)
    this.monitoringInterval = setInterval(() => {
      this.checkForNewFiles();
    }, 30000);
    
    // Initial check
    await this.checkForNewFiles();
    
    return { success: true };
  }
  
  stopMonitoring() {
    console.log('Stopping download monitoring...');
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Clear pending downloads from queue
    const queuedFiles = this.downloadQueue.filter(f => f.status === 'queued');
    const activeDownloads = this.downloadQueue.filter(f => f.status === 'downloading');
    
    // Clear the download queue completely - no new downloads will start
    this.downloadQueue = [];
    
    console.log(`Clearing download queue: ${queuedFiles.length} pending downloads cancelled, ${activeDownloads.length} active downloads will finish`);
    
    // Send cancel messages to all active workers to stop their current downloads
    for (const [jobId, { workerInfo, job }] of this.activeJobs) {
      console.log(`Sending cancel message to worker for job ${jobId} (${job.file.name})`);
      workerInfo.worker.postMessage({
        type: 'cancel-download',
        jobId: jobId
      });
    }
    
    // Send update to renderer about queue clearing
    this.sendDownloadUpdate({
      type: 'queue-cleared',
      message: `Download stopped - ${queuedFiles.length} queued downloads cancelled, ${activeDownloads.length} active downloads will finish`
    });
    
    // Send updated queue state
    this.sendQueueUpdate();
  }
  
  updateFileProgress(jobId, progressData) {
    // Find file in download queue
    const file = this.downloadQueue.find(f => f.jobId === jobId);
    if (file) {
      file.progress = progressData.progress || 0;
      file.downloadedBytes = progressData.downloadedBytes || 0;
      file.totalBytes = progressData.totalBytes || file.totalBytes || 0;
      
      // Send queue update to renderer
      this.sendQueueUpdate();
    }
  }
  
  trimCompletedFiles() {
    if (this.completedFiles.length > this.maxCompletedItems) {
      this.completedFiles = this.completedFiles.slice(0, this.maxCompletedItems);
    }
  }
  
  trimFailedFiles() {
    if (this.failedFiles.length > this.maxCompletedItems) {
      this.failedFiles = this.failedFiles.slice(0, this.maxCompletedItems);
    }
  }
  
  sendQueueUpdate() {
    const allFiles = [
      ...this.downloadQueue.filter(f => f.status === 'downloading'), // Active downloads first
      ...this.downloadQueue.filter(f => f.status === 'queued'), // Then queued
      ...this.completedFiles, // Then completed
      ...this.failedFiles // Finally failed
    ];
    
    const stats = {
      queued: this.downloadQueue.filter(f => f.status === 'queued').length,
      downloading: this.downloadQueue.filter(f => f.status === 'downloading').length,
      completed: this.completedFiles.length,
      failed: this.failedFiles.length
    };
    
    console.log('Sending queue update to renderer:', stats, 'Total files:', allFiles.length);
    
    this.sendDownloadUpdate({
      type: 'queue-update',
      files: allFiles,
      stats: stats
    });
  }
  
  async checkForNewFiles() {
    if (!this.isMonitoring) return;
    
    try {
      console.log('Checking for new files...');
      
      // Send monitoring update to renderer
      this.sendDownloadUpdate({
        type: 'monitoring-check',
        timestamp: new Date().toISOString()
      });
      
      const result = await this.fetchNewFilesFromServer();
      const { files: newFiles, hasMoreItems } = result;
      
      if (newFiles.length > 0) {
        console.log(`Found ${newFiles.length} new files`);
        
        // Add files to download queue
        for (const file of newFiles) {
          this.addFileToQueue(file);
        }
        
        // Send queue update to renderer
        this.sendQueueUpdate();
        
        // Process queue
        this.processQueue();
      }
      
      // If server indicates more items are available, schedule immediate check
      if (hasMoreItems) {
        console.log('Server has more items available - scheduling immediate check');
        // Use setTimeout to avoid blocking and allow current downloads to start
        setTimeout(() => {
          this.checkForNewFiles();
        }, 1000); // Small delay to allow current batch to start downloading
      }
      
    } catch (error) {
      console.error('Error checking for new files:', error);
      this.sendDownloadUpdate({
        type: 'monitoring-error',
        error: error.message
      });
    }
  }
  
  async fetchNewFilesFromServer() {
    try {
      // Use the latest downloaded file time if available, otherwise use the initial sync time
      const syncTime = this.latestDownloadedFileTime || this.lastSyncTime || '2025-01-01T00:00:00.000Z';
      
      console.log(`Checking server for files since: ${syncTime}`);
      
      // Get server configuration
      const config = getConfig();
      
      // Get authentication token
      if (!this.authToken) {
        console.log('No authentication token available for download monitoring');
        return { files: [], hasMoreItems: false };
      }
      
      // Make actual API call to ZenTransfer server
      const response = await fetch(`${config.SERVER_BASE_URL}/api/sync?since=${encodeURIComponent(syncTime)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('No new files found on server');
          return { files: [], hasMoreItems: false };
        }
        throw new Error(`Server responded with status ${response.status}: ${response.statusText}`);
      }
      
      // Check for X-More-Items header
      const moreItemsHeader = response.headers.get('X-More-Items');
      const hasMoreItems = moreItemsHeader && parseInt(moreItemsHeader, 10) > 0;
      
      if (hasMoreItems) {
        console.log(`Server indicates ${moreItemsHeader} more items available after this batch`);
      }
      
      const data = await response.json();
      console.log('Server response:', data);
      
      // Handle both array response and object with files property
      let files = [];
      if (Array.isArray(data)) {
        files = data;
      } else if (data.files && Array.isArray(data.files)) {
        files = data.files;
      } else if (data.success && data.data && Array.isArray(data.data)) {
        files = data.data;
      }
      
      if (files.length > 0) {
        console.log(`Found ${files.length} new files from server`);
        // Don't update sync time here - it will be updated when files are successfully downloaded
      } else {
        console.log('No new files found');
      }
      
      return { files, hasMoreItems };
      
    } catch (error) {
      console.error('Error fetching files from server:', error);
      
      // Don't throw error for network issues - just return empty result
      // This prevents monitoring from stopping due to temporary network issues
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.log('Network error - will retry on next check');
      }
      
      return { files: [], hasMoreItems: false };
    }
  }
  
  addFileToQueue(fileInfo) {
    const file = {
      id: fileInfo.id || Date.now() + Math.random(),
      jobId: null, // Will be assigned when download starts
      name: fileInfo.name,
      size: fileInfo.size,
      type: fileInfo.type,
      status: 'queued',
      created: fileInfo.created,
      downloadUrl: fileInfo.downloadUrl || fileInfo.url,
      thumbnail_url: fileInfo.thumbnail_url,
      addedAt: Date.now(),
      progress: 0,
      downloadedBytes: 0,
      totalBytes: fileInfo.size || 0,
      error: null
    };
    
    this.downloadQueue.push(file);
    console.log(`Added file to queue: ${file.name} (queue size: ${this.downloadQueue.length})`);
  }
  
  processQueue() {
    // Start downloads for available workers
    const availableWorkers = this.workers.filter(w => !w.busy);
    const queuedFiles = this.downloadQueue.filter(f => f.status === 'queued');
    
    for (let i = 0; i < Math.min(availableWorkers.length, queuedFiles.length); i++) {
      const worker = availableWorkers[i];
      const file = queuedFiles[i];
      this.startDownload(worker, file);
    }
  }
  
  startDownload(workerInfo, file) {
    const jobId = ++this.jobIdCounter;
    file.jobId = jobId;
    file.status = 'downloading';
    
    const job = {
      id: jobId,
      file,
      downloadPath: this.downloadPath,
      timestamp: Date.now()
    };
    
    workerInfo.busy = true;
    workerInfo.currentJob = job;
    this.activeJobs.set(jobId, { workerInfo, job });
    
    workerInfo.worker.postMessage({
      type: 'download-file',
      jobId: jobId,
      fileInfo: file,
      downloadPath: this.downloadPath
    });
    
    console.log(`Started download: ${file.name} (jobId: ${jobId})`);
    this.sendQueueUpdate();
  }
  
  handleWorkerMessage(worker, message) {
    const { type, jobId } = message;
    
    if (type === 'progress') {
      // Update file progress in queue
      this.updateFileProgress(jobId, message);
      return;
    }
    
    if (type === 'result' || type === 'error') {
      const jobInfo = this.activeJobs.get(jobId);
      if (!jobInfo) return;
      
      const { workerInfo, job } = jobInfo;
      const file = job.file;
      
      // Update file status
      if (type === 'result') {
        file.status = 'completed';
        file.progress = 100;
        file.filePath = message.filePath;
        file.fileSize = message.fileSize;
        file.completedAt = Date.now();
        
        // Move to completed list
        this.completedFiles.unshift(file); // Add to beginning
        this.trimCompletedFiles();
        
        // Update sync time based on file's created timestamp
        if (file.created) {
          const fileCreatedTime = file.created;
          console.log(`Download completed for ${file.name}, created: ${fileCreatedTime}`);
          
          if (!this.latestDownloadedFileTime || fileCreatedTime > this.latestDownloadedFileTime) {
            this.latestDownloadedFileTime = fileCreatedTime;
            console.log(`Updated latest downloaded file time to: ${this.latestDownloadedFileTime}`);
            
            // Send sync time update to renderer
            this.sendDownloadUpdate({
              type: 'sync-time-update',
              syncTime: this.latestDownloadedFileTime
            });
          }
        }
      } else {
        file.status = 'failed';
        file.error = message.error;
        file.completedAt = Date.now();
        
        // Move to failed list
        this.failedFiles.unshift(file); // Add to beginning
        this.trimFailedFiles();
      }
      
      // Remove from download queue
      const queueIndex = this.downloadQueue.findIndex(f => f.jobId === jobId);
      if (queueIndex !== -1) {
        this.downloadQueue.splice(queueIndex, 1);
      }
      
      // Free up worker
      workerInfo.busy = false;
      workerInfo.currentJob = null;
      this.activeJobs.delete(jobId);
      
      // Send queue update to renderer
      this.sendQueueUpdate();
      
      // Process next files in queue
      this.processQueue();
    }
  }
  
  handleWorkerError(worker, error) {
    // Find jobs assigned to this worker and handle them
    for (const [jobId, { workerInfo, job }] of this.activeJobs) {
      if (workerInfo.worker === worker) {
        this.activeJobs.delete(jobId);
        workerInfo.busy = false;
        workerInfo.currentJob = null;
        
        // Send error to renderer
        this.sendDownloadUpdate({
          type: 'error',
          jobId,
          error: error.message
        });
      }
    }
  }
  
  sendDownloadUpdate(updateData) {
    // Send download update to all renderer processes
    BrowserWindow.getAllWindows().forEach(window => {
      try {
        // Check if the window and webContents are still valid
        if (window && !window.isDestroyed() && window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send('download-update', updateData);
        }
      } catch (error) {
        // Silently ignore IPC errors - the window may have been disposed
        console.log('IPC send failed (window disposed):', error.message);
      }
    });
  }
  
  getStats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      queueLength: this.downloadQueue.filter(f => f.status === 'queued').length,
      activeJobs: this.activeJobs.size,
      completedCount: this.completedFiles.length,
      failedCount: this.failedFiles.length,
      isMonitoring: this.isMonitoring
    };
  }
}

// Global download worker manager
let downloadWorkerPool;

function createWindow() {
  // Calculate window dimensions for 9:16 aspect ratio
  const width = 400;
  const height = Math.round(width * (16 / 9));

  const mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 350,
    minHeight: Math.round(350 * (16 / 9)),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'default',
    resizable: true,
    show: false
  });

  mainWindow.loadFile('src/index.html');

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
  setupIpcHandlers();
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

// IPC handlers
function setupIpcHandlers() {
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
} 