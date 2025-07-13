/**
 * Download Worker Manager
 * Manages download worker threads for handling file download operations
 * Extracted from main.js for better modularity
 */

const { BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');

// Import shared configuration
const sharedConfig = require('../../shared/config.js');

const getConfig = () => sharedConfig;

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
    const workerPath = path.join(__dirname, '../../workers/download', 'download-worker-main.js');
    
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
    let interval = 30000;
    if (sharedConfig.isDevelopment) {
      interval = 1000;
    }

    this.monitoringInterval = setInterval(() => {
      this.checkForNewFiles();
    }, interval);
    
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
      const response = await fetch(`${config.serverBaseUrl}/api/sync?since=${encodeURIComponent(syncTime)}`, {
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

module.exports = { DownloadWorkerManager }; 