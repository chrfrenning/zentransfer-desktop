/**
 * Upload Worker Pool
 * Manages a pool of worker threads for handling file uploads with SQLite queue
 * Extracted from main.js for better modularity
 */

const { BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const { UploadQueue } = require('../services/upload-queue.js');
const { UploadBackoffManager } = require('../services/upload-backoff-manager.js');

class UploadWorkerPool {
  constructor(poolSize = 3) {
    this.workers = [];
    this.activeJobs = new Map();
    this.jobIdCounter = 0;
    this.isProcessing = false;
    
    // SQLite queue manager
    this.uploadQueue = null;
    this.backoffManager = new UploadBackoffManager();
    
    // Queue processing timer
    this.queueProcessingInterval = null;
    
    // Create worker pool
    for (let i = 0; i < poolSize; i++) {
      this.createWorker(i);
    }
    
    console.log(`Upload worker pool initialized with ${poolSize} workers and SQLite queue`);
  }
  
  /**
   * Initialize the upload queue and start processing
   */
  async initialize(configManager) {
    if (this.uploadQueue) return; // Already initialized
    
    try {
      // Initialize SQLite queue
      this.uploadQueue = new UploadQueue();
      this.uploadQueue.initialize(configManager);
      
      // Reset any stuck "processing" files to "queued" on startup
      this.uploadQueue.resetProcessingFiles();
      
      // Start queue processing timer
      this.startQueueProcessing();
      
      console.log('Upload worker pool initialized with SQLite queue');
    } catch (error) {
      console.error('Failed to initialize upload worker pool:', error);
      throw error;
    }
  }
  
  /**
   * Start queue processing timer
   */
  startQueueProcessing() {
    if (this.queueProcessingInterval) return; // Already started
    
    this.queueProcessingInterval = setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        console.error('Error in upload queue processing:', error);
      }
    }, 1000); // Check every second
    
    console.log('Started upload queue processing timer');
  }
  
  /**
   * Stop queue processing timer
   */
  stopQueueProcessing() {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
      console.log('Stopped upload queue processing timer');
    }
  }
  
  /**
   * Process the upload queue
   */
  async processQueue() {
    if (!this.uploadQueue || this.backoffManager.isInBackoff()) return;
    
    // Get available workers and ready files
    const availableWorkers = this.workers.filter(w => !w.busy);
    if (availableWorkers.length === 0) return;
    
    const readyFiles = this.uploadQueue.getReadyFiles(availableWorkers.length);
    if (readyFiles.length === 0) return;
    
    console.log(`Processing upload queue: ${availableWorkers.length} available workers, ${readyFiles.length} ready files`);
    
    // Start uploads for available workers
    for (let i = 0; i < Math.min(availableWorkers.length, readyFiles.length); i++) {
      const worker = availableWorkers[i];
      const file = readyFiles[i];
      await this.startUpload(worker, file);
    }
  }
  
  /**
   * Start upload for a specific file
   */
  async startUpload(workerInfo, file) {
    const jobId = ++this.jobIdCounter;
    
    const job = {
      id: jobId,
      file: file, // Database file record
      timestamp: Date.now()
    };
    
    // Update database to mark as processing
    this.uploadQueue.startUpload(file.id);
    
    workerInfo.busy = true;
    workerInfo.currentJob = job;
    this.activeJobs.set(jobId, { workerInfo, job });
    
    // Send to worker
    workerInfo.worker.postMessage({
      type: 'upload-file',
      jobId: jobId,
      fileData: {
        fileId: file.id,
        fileName: file.filename,
        filePath: file.file_path,
        fileSize: file.file_size,
        mimeType: file.mime_type,
        serviceType: file.service_type,
        importSettings: file.import_settings ? JSON.parse(file.import_settings) : null
      }
    });
    
    console.log(`Started upload: ${file.filename} (jobId: ${jobId}, fileId: ${file.id})`);
    
    // Send progress update to renderer
    this.sendProgressUpdate({
      type: 'upload-started',
      fileId: file.id,
      jobId: jobId,
      fileName: file.filename,
      progress: 0,
      status: 'processing'
    });
    
    this.sendQueueUpdate();
  }
  
  createWorker(id) {
    console.log(`Creating upload worker ${id}...`);
    const workerPath = path.join(__dirname, '../../workers/upload', 'upload-worker.js');
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
  
  /**
   * Add files to the upload queue (replaces execute method)
   */
  async addFilesToQueue(files) {
    if (!this.uploadQueue) {
      throw new Error('Upload queue not initialized');
    }
    
    const results = this.uploadQueue.addFiles(files);
    
    // Trigger queue processing (will be handled by timer)
    this.sendQueueUpdate();
    
    return results;
  }
  
  /**
   * Legacy execute method for backward compatibility
   * Now delegates to upload queue
   */
  async execute(jobData) {
    // Handle different job types
    if (jobData.type === 'upload-file') {
      // Direct upload (legacy path) - convert to queue format
      const file = {
        filePath: jobData.fileData.filePath || jobData.fileData.file?.path,
        filename: jobData.fileData.fileName,
        fileSize: jobData.fileData.fileSize,
        mimeType: jobData.fileData.mimeType || jobData.fileData.fileType,
        serviceType: jobData.sessionData?.selectedService || 'zentransfer',
        dateAdded: new Date().toISOString(),
        importSettings: jobData.fileData.importSettings ? JSON.stringify(jobData.fileData.importSettings) : null
      };
      
      const results = await this.addFilesToQueue([file]);
      return results[0];
    }
    
    // Handle other job types that don't go through queue
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
        this.assignLegacyJob(availableWorker, job);
      } else {
        // For non-upload jobs, we still use immediate processing
        // Queue them in memory temporarily
        setTimeout(() => {
          const worker = this.workers.find(w => !w.busy);
          if (worker) {
            this.assignLegacyJob(worker, job);
          } else {
            reject(new Error('No workers available'));
          }
        }, 100);
      }
    });
  }
  
  /**
   * Assign legacy jobs (non-upload) directly to workers
   */
  assignLegacyJob(workerInfo, job) {
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
      // Forward progress updates to renderer (in-memory only)
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
      
      if (job.file && this.uploadQueue) {
        // This is an upload job from the queue
        if (type === 'error') {
          // Mark as failed in database
          this.uploadQueue.failUpload(job.file.id, message.error);
          this.backoffManager.onUploadFailure();
          
          console.log(`Upload failed: ${job.file.filename} - ${message.error}`);
          
          // Send error to renderer
          this.sendProgressUpdate({
            type: 'upload-failed',
            fileId: job.file.id,
            jobId: jobId,
            fileName: job.file.filename,
            error: message.error,
            status: 'failed'
          });
        } else {
          // Mark as completed in database
          this.uploadQueue.completeUpload(job.file.id, message.result.finalUrl);
          this.backoffManager.onUploadSuccess();
          
          console.log(`Upload completed: ${job.file.filename}`);
          
          // Send success to renderer
          this.sendProgressUpdate({
            type: 'upload-completed',
            fileId: job.file.id,
            jobId: jobId,
            fileName: job.file.filename,
            finalUrl: message.result.finalUrl,
            status: 'completed'
          });
        }
        
        // Send queue update after status change
        this.sendQueueUpdate();
      } else {
        // This is a legacy job (non-upload)
        if (type === 'error') {
          job.reject(new Error(message.error));
        } else {
          job.resolve(message.result);
        }
      }
    }
  }
  
  handleWorkerError(worker, error) {
    // Find jobs assigned to this worker and handle them
    for (const [jobId, { workerInfo, job }] of this.activeJobs) {
      if (workerInfo.worker === worker) {
        if (job.file && this.uploadQueue) {
          // This is an upload job from the queue - mark as failed
          this.uploadQueue.failUpload(job.file.id, `Worker error: ${error.message}`);
          this.backoffManager.onUploadFailure();
          
          console.log(`Upload worker error for ${job.file.filename}:`, error);
          
          // Send error to renderer
          this.sendProgressUpdate({
            type: 'upload-failed',
            fileId: job.file.id,
            jobId: jobId,
            fileName: job.file.filename,
            error: `Worker error: ${error.message}`,
            status: 'failed'
          });
        } else {
          // This is a legacy job - reject promise
          job.reject(error);
        }
        
        this.activeJobs.delete(jobId);
        workerInfo.busy = false;
        workerInfo.currentJob = null;
      }
    }
    
    // Send queue update after error handling
    if (this.uploadQueue) {
      this.sendQueueUpdate();
    }
  }
  
  sendProgressUpdate(progressData) {
    // Send progress update to all renderer processes
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('upload-progress', progressData);
    });
  }
  
  /**
   * Send queue update to renderer processes
   */
  sendQueueUpdate() {
    if (!this.uploadQueue) return;
    
    try {
      const stats = this.getStats();
      
      // Get all files for UI display
      const queuedFiles = this.uploadQueue.getReadyFiles();
      const failedFiles = this.uploadQueue.getFailedFiles();
      
      // Convert active jobs to display format
      const processingFiles = Array.from(this.activeJobs.values())
        .filter(job => job.job.file)
        .map(job => ({
          ...job.job.file,
          status: 'processing'
        }));
      
      const allFiles = [
        ...processingFiles,
        ...queuedFiles,
        ...failedFiles
      ];
      
      // Send update to all renderer processes
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('upload-update', {
          type: 'queue-update',
          files: allFiles,
          stats: stats,
          backoffState: this.backoffManager.getState()
        });
      });
      
    } catch (error) {
      console.error('Failed to send upload queue update:', error);
    }
  }
  
  getStats() {
    const baseStats = {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      activeJobs: this.activeJobs.size
    };
    
    if (this.uploadQueue) {
      const queueStats = this.uploadQueue.getStats();
      return {
        ...baseStats,
        ...queueStats
      };
    }
    
    return baseStats;
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
      
      if (job.file && this.uploadQueue) {
        // Reset database upload back to queued (so it can be retried later)
        this.uploadQueue.retryFile(job.file.id);
      } else {
        // Reject legacy job promise
        job.reject(new Error('Upload cancelled by user'));
      }
      
      // Free up worker
      workerInfo.busy = false;
      workerInfo.currentJob = null;
    }
    
    // Clear all active jobs
    this.activeJobs.clear();
    
    // Reset backoff (user action)
    this.backoffManager.forceReset();
    
    console.log('All upload jobs cancelled');
    
    // Send queue update
    this.sendQueueUpdate();
  }
  
  /**
   * Get maximum upload retries from preferences
   */
  getMaxUploadRetries() {
    try {
      const { getConfig } = require('../app/main-config-setup.js');
      const preferences = getConfig('preferences');
      return preferences?.maxUploadRetries || 5;
    } catch (error) {
      console.warn('Failed to get maxUploadRetries from preferences, using default:', error);
      return 5;
    }
  }
  
  /**
   * Retry failed uploads
   */
  retryFailedUploads() {
    if (!this.uploadQueue) {
      throw new Error('Upload queue not initialized');
    }
    
    const failedFiles = this.uploadQueue.getFailedFiles();
    const maxRetries = this.getMaxUploadRetries();
    
    let retriedCount = 0;
    for (const file of failedFiles) {
      if (file.retry_count < maxRetries) {
        this.uploadQueue.retryFile(file.id);
        retriedCount++;
      }
    }
    
    if (retriedCount > 0) {
      // Reset backoff when user manually retries
      this.backoffManager.forceReset();
      console.log(`Retried ${retriedCount} failed uploads`);
      this.sendQueueUpdate();
    }
    
    return retriedCount;
  }
  
  /**
   * Clear completed uploads from queue
   */
  clearCompleted() {
    if (!this.uploadQueue) {
      throw new Error('Upload queue not initialized');
    }
    
    const result = this.uploadQueue.clearCompleted();
    this.sendQueueUpdate();
    return result;
  }
  
  /**
   * Get incomplete files (for app restart recovery)
   */
  getIncompleteFiles() {
    if (!this.uploadQueue) return [];
    
    const maxRetries = this.getMaxUploadRetries();
    return this.uploadQueue.getIncompleteFiles(maxRetries);
  }
  
  /**
   * Close and cleanup
   */
  close() {
    this.stopQueueProcessing();
    
    if (this.uploadQueue) {
      this.uploadQueue.close();
    }
    
    // Terminate all workers
    for (const workerInfo of this.workers) {
      workerInfo.worker.terminate();
    }
    
    this.workers = [];
    this.activeJobs.clear();
  }
}

module.exports = { UploadWorkerPool }; 