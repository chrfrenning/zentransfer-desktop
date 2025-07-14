/**
 * Download Worker Manager
 * Manages download worker threads for handling file download operations
 * Now with SQLite-based persistent queue and retry logic
 */

const { BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');

// Import shared configuration
const sharedConfig = require('../../shared/config.js');
const { DownloadQueue } = require('../services/download-queue.js');

const getConfig = () => sharedConfig;

class DownloadWorkerManager {
  constructor() {
    this.workers = [];
    this.activeJobs = new Map(); // Currently downloading files
    this.jobIdCounter = 0;
    this.isMonitoring = false;
    this.pollingTimeout = null;
    this.lastSyncTime = null;
    this.latestDownloadedFileTime = null;
    this.downloadPath = null;
    this.authToken = null;
    this.pollingInterval = 30000; // 30 seconds default polling interval
    
    // SQLite queue manager
    this.queueManager = null;
    this.maxCompletedItems = 20; // Maximum completed items to keep for display
    
    // Legacy arrays for UI compatibility (populated from database)
    this.completedFiles = [];
    this.failedFiles = [];
    
    // Create workers (number configurable via config)
    this.createWorkers();
    
    console.log('Download worker manager initialized with SQLite queue');
  }
  
  /**
   * Create download workers
   */
  createWorkers() {
    // Get worker count from config or default to 3
    let workerCount = 3;
    try {
      const downloadSettings = require('../app/main-config-setup.js').getConfig('downloadSettings');
      if (downloadSettings && downloadSettings.downloadQueue) {
        workerCount = downloadSettings.downloadQueue.maxConcurrentDownloads || 3;
      }
    } catch (error) {
      console.warn('Failed to get worker count from config, using default:', error);
    }
    
    for (let i = 0; i < workerCount; i++) {
      this.createWorker(i);
    }
    
    console.log(`Download worker manager initialized with ${workerCount} workers`);
  }
  
  /**
   * Initialize queue manager
   */
  initializeQueue(configManager) {
    if (!this.queueManager) {
      this.queueManager = new DownloadQueue();
      this.queueManager.initialize(configManager);
      
      // Reset any files that were downloading when app shut down
      this.queueManager.resetDownloadingFiles();
      
      console.log('Download queue manager initialized');
    }
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
    
    // Initialize queue manager if not already done
    if (!this.queueManager) {
      const { getConfigManager } = require('../app/main-config-setup.js');
      this.initializeQueue(getConfigManager());
    }
    
    this.isMonitoring = true;
    this.downloadPath = downloadPath;
    this.lastSyncTime = lastSyncTime || '2025-01-01T00:00:00.000Z';
    this.authToken = authToken;
    
    console.log(`Starting download monitoring with sync time: ${this.lastSyncTime}`);
    
    if (!this.authToken) {
      console.warn('No authentication token provided for download monitoring');
    }
    
    // Set polling interval (shorter in development)
    if (sharedConfig.isDevelopment) {
      this.pollingInterval = 5000; // 5 seconds in dev
    } else {
      this.pollingInterval = 30000; // 30 seconds in production
    }
    
    // Process any existing incomplete downloads first
    await this.processQueue();
    
    // Start with immediate check for new files
    await this.checkForNewFiles();
    
    return { success: true };
  }
  
  stopMonitoring() {
    console.log('Stopping download monitoring...');
    this.isMonitoring = false;
    
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
    
    // Get active downloads
    const activeDownloads = this.activeJobs.size;
    
    console.log(`Stopping monitoring: ${activeDownloads} active downloads will finish`);
    
    // Send cancel messages to all active workers to stop their current downloads
    for (const [jobId, { workerInfo, job }] of this.activeJobs) {
      console.log(`Sending cancel message to worker for job ${jobId} (${job.file.name})`);
      workerInfo.worker.postMessage({
        type: 'cancel-download',
        jobId: jobId
      });
    }
    
    // Send update to renderer about monitoring stopping
    this.sendDownloadUpdate({
      type: 'queue-cleared',
      message: `Download monitoring stopped - ${activeDownloads} active downloads will finish`
    });
    
    // Send updated queue state
    this.sendQueueUpdate();
  }
  
  updateFileProgress(jobId, progressData) {
    // Send progress update to renderer - no database update needed for progress
    this.sendQueueUpdate();
  }
  
  /**
   * Build legacy arrays from database for UI compatibility
   */
  updateLegacyArrays() {
    if (!this.queueManager) return;
    
    try {
      // Get completed and failed files for UI display
      const allCompleted = this.queueManager.db.prepare(`
        SELECT * FROM download_queue 
        WHERE status = 'completed' 
        ORDER BY download_completed_at DESC 
        LIMIT ?
      `).all(this.maxCompletedItems);
      
      const allFailed = this.queueManager.db.prepare(`
        SELECT * FROM download_queue 
        WHERE status = 'failed' 
        AND retry_count >= max_retries
        ORDER BY last_retry_at DESC 
        LIMIT ?
      `).all(this.maxCompletedItems);
      
      // Convert to legacy format
      this.completedFiles = allCompleted.map(file => this.convertDbFileToLegacy(file));
      this.failedFiles = allFailed.map(file => this.convertDbFileToLegacy(file));
      
    } catch (error) {
      console.error('Failed to update legacy arrays:', error);
    }
  }
  
  /**
   * Convert database file record to legacy format for UI compatibility
   */
  convertDbFileToLegacy(dbFile) {
    return {
      id: dbFile.file_id,
      jobId: dbFile.job_id,
      name: dbFile.name,
      size: dbFile.file_size,
      status: dbFile.status,
      created: dbFile.created_at,
      downloadUrl: dbFile.url,
      thumbnail_url: dbFile.thumbnail_url,
      addedAt: new Date(dbFile.added_to_queue_at).getTime(),
      progress: dbFile.status === 'completed' ? 100 : 0,
      downloadedBytes: dbFile.status === 'completed' ? dbFile.file_size : 0,
      totalBytes: dbFile.file_size || 0,
      error: dbFile.error_message,
      filePath: dbFile.file_path,
      completedAt: dbFile.download_completed_at ? new Date(dbFile.download_completed_at).getTime() : null,
      retryCount: dbFile.retry_count
    };
  }
  
  sendQueueUpdate() {
    if (!this.queueManager) return;
    
    try {
      // Update legacy arrays
      this.updateLegacyArrays();
      
      // Get current files from database
      const pendingFiles = this.queueManager.getReadyFiles();
      const downloadingFiles = Array.from(this.activeJobs.values()).map(job => this.convertDbFileToLegacy(job.file));
      
      const allFiles = [
        ...downloadingFiles, // Active downloads first
        ...pendingFiles.map(file => this.convertDbFileToLegacy(file)), // Then pending
        ...this.completedFiles, // Then completed
        ...this.failedFiles // Finally failed
      ];
      
      const stats = this.queueManager.getStats();
      stats.downloading = this.activeJobs.size; // Override with actual active downloads
      
      console.log('Sending queue update to renderer:', stats, 'Total files:', allFiles.length);
      
      this.sendDownloadUpdate({
        type: 'queue-update',
        files: allFiles,
        stats: stats
      });
      
    } catch (error) {
      console.error('Failed to send queue update:', error);
    }
  }
  
  async checkForNewFiles() {
    if (!this.isMonitoring || !this.queueManager) return;
    
    // Check if we have capacity for more downloads
    const availableWorkers = this.workers.filter(w => !w.busy).length;
    const pendingFiles = this.queueManager.getReadyFiles(availableWorkers).length;
    
    if (availableWorkers === 0 || pendingFiles >= availableWorkers) {
      console.log('Workers busy or enough files queued, skipping new file check');
      return;
    }
    
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
        
        // Add files to database queue
        const addResults = this.queueManager.addFiles(newFiles);
        const addedCount = addResults.filter(r => r.added).length;
        
        console.log(`Added ${addedCount} new files to database queue`);
        
        // Send queue update to renderer
        this.sendQueueUpdate();
        
        // Process queue
        await this.processQueue();
        
        // If server indicates more items are available, schedule immediate check
        if (hasMoreItems) {
          console.log('Server has more items available - scheduling immediate check');
          this.scheduleNextCheck(1000); // Small delay to allow current batch to start downloading
        }
        
      } else {
        console.log('No new files found - scheduling next check');
        this.scheduleNextCheck(this.pollingInterval);
      }
      
    } catch (error) {
      console.error('Error checking for new files:', error);
      this.sendDownloadUpdate({
        type: 'monitoring-error',
        error: error.message
      });
      
      // Schedule retry after error
      this.scheduleNextCheck(this.pollingInterval);
    }
  }
  
  scheduleNextCheck(delay) {
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
    }
    
    this.pollingTimeout = setTimeout(() => {
      this.checkForNewFiles();
    }, delay);
  }
  
  checkQueueAndPoll() {
    if (!this.isMonitoring || !this.queueManager) return;
    
    // Check if we have available workers and ready files
    const availableWorkers = this.workers.filter(w => !w.busy).length;
    const readyFiles = this.queueManager.getReadyFiles(1); // Just check if any exist
    
    if (availableWorkers > 0 && readyFiles.length === 0) {
      console.log('Workers available but no ready files - checking for new files');
      // Clear any scheduled polling timeout since we're checking immediately
      if (this.pollingTimeout) {
        clearTimeout(this.pollingTimeout);
        this.pollingTimeout = null;
      }
      this.checkForNewFiles();
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
      } else if (data && Array.isArray(data.files)) {
        files = data.files;
      } else if (data && data.file) {
        files = [data.file];
      }
      
      return { files, hasMoreItems };
      
    } catch (error) {
      console.error('Failed to fetch new files from server:', error);
      throw error;
    }
  }
  
  async processQueue() {
    if (!this.queueManager) return;
    
    // Start downloads for available workers
    const availableWorkers = this.workers.filter(w => !w.busy);
    const readyFiles = this.queueManager.getReadyFiles(availableWorkers.length);
    
    console.log(`Processing queue: ${availableWorkers.length} available workers, ${readyFiles.length} ready files`);
    
    for (let i = 0; i < Math.min(availableWorkers.length, readyFiles.length); i++) {
      const worker = availableWorkers[i];
      const file = readyFiles[i];
      await this.startDownload(worker, file);
    }
    
    // If no files were started and no files are ready, check for new files
    if (readyFiles.length === 0 && this.activeJobs.size === 0) {
      this.checkQueueAndPoll();
    }
  }
  
  async startDownload(workerInfo, file) {
    const jobId = ++this.jobIdCounter;
    
    // Convert database file to legacy format for worker
    const legacyFile = this.convertDbFileToLegacy(file);
    legacyFile.jobId = jobId;
    
    const job = {
      id: jobId,
      file: file, // Keep original db file for updates
      legacyFile: legacyFile, // For worker compatibility
      downloadPath: this.downloadPath,
      timestamp: Date.now()
    };
    
    // Update database
    this.queueManager.startDownload(file.file_id, jobId);
    
    workerInfo.busy = true;
    workerInfo.currentJob = job;
    this.activeJobs.set(jobId, { workerInfo, job });
    
    workerInfo.worker.postMessage({
      type: 'download-file',
      jobId: jobId,
      fileInfo: legacyFile, // Send legacy format to worker
      downloadPath: this.downloadPath
    });
    
    console.log(`Started download: ${file.name} (jobId: ${jobId})`);
    
    // Send immediate notification that download started
    this.sendDownloadUpdate({
      type: 'download-started',
      file: this.convertDbFileToLegacy(file),
      jobId: jobId
    });
    
    this.sendQueueUpdate();
  }
  
  async handleWorkerMessage(worker, message) {
    const { type, jobId } = message;
    
    if (type === 'progress') {
      // Update file progress in UI only (not database)
      this.updateFileProgress(jobId, message);
      return;
    }
    
    if (type === 'result' || type === 'error') {
      const jobInfo = this.activeJobs.get(jobId);
      if (!jobInfo) return;
      
      const { workerInfo, job } = jobInfo;
      const file = job.file; // Original database file
      
      // Update database based on result
      if (type === 'result') {
        // Mark as completed in database
        this.queueManager.completeDownload(file.file_id, message.filePath, message.fileSize);
        
        // Send immediate notification that download completed
        this.sendDownloadUpdate({
          type: 'download-completed',
          file: this.convertDbFileToLegacy(file),
          jobId: jobId,
          filePath: message.filePath,
          fileSize: message.fileSize
        });
        
        // Update sync time based on file's created timestamp
        if (file.created_at) {
          const fileCreatedTime = file.created_at;
          console.log(`Download completed for ${file.name}, created: ${fileCreatedTime}`);
          
          if (!this.latestDownloadedFileTime || fileCreatedTime > this.latestDownloadedFileTime) {
            this.latestDownloadedFileTime = fileCreatedTime;
            console.log(`Updated latest downloaded file time to: ${this.latestDownloadedFileTime}`);
            
            // Save to config system
            try {
              const { setConfig } = require('../app/main-config-setup.js');
              setConfig('downloadSettings.lastSyncTime', this.latestDownloadedFileTime);
              console.log('Saved updated sync time to config');
            } catch (error) {
              console.error('Failed to save sync time to config:', error);
            }
            
            // Send sync time update to renderer
            this.sendDownloadUpdate({
              type: 'sync-time-update',
              syncTime: this.latestDownloadedFileTime
            });
          }
        }
        
      } else {
        // Mark as failed in database with retry logic
        this.queueManager.failDownload(file.file_id, message.error);
        
        // Send immediate notification that download failed
        this.sendDownloadUpdate({
          type: 'download-failed',
          file: this.convertDbFileToLegacy(file),
          jobId: jobId,
          error: message.error
        });
      }
      
      // Free up worker
      workerInfo.busy = false;
      workerInfo.currentJob = null;
      this.activeJobs.delete(jobId);
      
      // Send queue update to renderer
      this.sendQueueUpdate();
      
      // Process next files in queue
      await this.processQueue();
      
      // Check if queue is empty and poll for new files if needed
      this.checkQueueAndPoll();
    }
  }
  
  handleWorkerError(worker, error) {
    // Find jobs assigned to this worker and handle them
    for (const [jobId, { workerInfo, job }] of this.activeJobs) {
      if (workerInfo.worker === worker) {
        // Mark as failed in database
        if (this.queueManager && job.file) {
          this.queueManager.failDownload(job.file.file_id, error.message);
        }
        
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
    const baseStats = {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      activeJobs: this.activeJobs.size,
      isMonitoring: this.isMonitoring
    };
    
    if (this.queueManager) {
      const queueStats = this.queueManager.getStats();
      return {
        ...baseStats,
        queueLength: queueStats.pending || 0,
        completedCount: queueStats.completed || 0,
        failedCount: queueStats.failed || 0,
        totalFiles: queueStats.total || 0
      };
    }
    
    return {
      ...baseStats,
      queueLength: 0,
      completedCount: this.completedFiles.length,
      failedCount: this.failedFiles.length,
      totalFiles: 0
    };
  }
  
  /**
   * Get queue manager for direct access (if needed)
   */
  getQueueManager() {
    return this.queueManager;
  }
  
  /**
   * Cleanup method
   */
  cleanup() {
    if (this.queueManager) {
      this.queueManager.close();
      this.queueManager = null;
    }
  }
}

module.exports = { DownloadWorkerManager }; 