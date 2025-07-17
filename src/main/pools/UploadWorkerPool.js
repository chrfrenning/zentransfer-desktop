/**
 * Upload Worker Pool
 * Manages a pool of worker threads for handling file uploads with SQLite queue
 * Extracted from main.js for better modularity
 */

const { BrowserWindow, app } = require('electron');
const { Worker } = require('worker_threads');
const { UploadQueue } = require('../queues/UploadQueue.js');
const { BackOffManager } = require('../services/BackOffManager.js');
const path = require('path');
const logger = require('../utils/Logger.js');

class UploadWorkerPool {
  constructor(poolSize) {
    this.workers = [];
    this.activeJobs = new Map();
    this.jobIdCounter = 0;
    this.isProcessing = false;
    
    // Initialize SQLite queue
    this.uploadQueue = new UploadQueue();
    
    // Reset any stuck "processing" files to "queued" on startup
    this.uploadQueue.resetProcessingFiles();

    // Some help with exponential backoffs when stuff go awry
    const backoffConfig = app.configurationManager.get('uploadSettings.uploadBackoff');
    this.backoffManager = new BackOffManager(
      backoffConfig.initialInterval,
      backoffConfig.maxInterval, 
      backoffConfig.multiplier, 
      backoffConfig.resetOnSuccess);
    
    // Queue processing timer
    this.queueProcessingInterval = null;
    
    // Dependencies for session data
    this.configManager = null;
    this.mainTokenManager = null;
    
    // Create worker pool
    for (let i = 0; i < poolSize; i++) {
      this.createWorker(i);
    }
    
    logger.info(`Upload worker pool initialized with ${poolSize} workers and SQLite queue`);
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
    
    logger.info('Started upload queue processing timer');
  }
  
  /**
   * Stop queue processing timer
   */
  stopQueueProcessing() {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
      logger.info('Stopped upload queue processing timer');
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
    
    logger.info(`Processing upload queue: ${availableWorkers.length} available workers, ${readyFiles.length} ready files`);
    
    // Start uploads for available workers
    for (let i = 0; i < Math.min(availableWorkers.length, readyFiles.length); i++) {
      const worker = availableWorkers[i];
      const file = readyFiles[i];
      await this.startUpload(worker, file);
    }
  }
  
  /**
   * Generate session data for worker
   */
  async generateSessionData(fileServiceType) {
    try {
      const sharedConfig = require('../configuration/Globals.js');
      
      // Get token for ZenTransfer uploads
      let token = null;
      if (fileServiceType === 'zentransfer') {
        if (this.mainTokenManager) {
          const tokenResult = await this.mainTokenManager.getValidToken();
          if (tokenResult) {
            token = tokenResult;
          }
        }
      }
      
      // Get service preferences from config (if available)
      let servicePreferences = {};
      if (this.configManager) {
        try {
          // Get cloud service configurations using config manager
          const awsS3ServiceObj = this.configManager.getClou('aws-s3');
          const azureServiceObj = this.configManager.getCloudSettings('azure-blob');
          const gcpServiceObj = this.configManager.getCloudSettings('gcp-storage');
          const minioServiceObj = this.configManager.getCloudSettings('minio');
          
          // Convert to full config objects
          const awsS3Service = awsS3ServiceObj ? awsS3ServiceObj.toConfig() : null;
          const azureService = azureServiceObj ? azureServiceObj.toConfig() : null;
          const gcpService = gcpServiceObj ? gcpServiceObj.toConfig() : null;
          const minioService = minioServiceObj ? minioServiceObj.toConfig() : null;
          
          // Convert to the format expected by upload workers
          servicePreferences = {};
          
          // AWS S3
          if (awsS3Service && awsS3Service.enabled) {
            servicePreferences.awsS3Enabled = awsS3Service.enabled;
            servicePreferences.awsS3Region = awsS3Service.region;
            servicePreferences.awsS3Bucket = awsS3Service.bucket;
            servicePreferences.awsS3AccessKey = awsS3Service.accessKey;
            servicePreferences.awsS3SecretKey = awsS3Service.secretKey;
            servicePreferences.awsS3StorageTier = awsS3Service.storageClass;
          }
          
          // Azure Blob Storage
          if (azureService && azureService.enabled) {
            servicePreferences.azureEnabled = azureService.enabled;
            servicePreferences.azureConnectionString = azureService.connectionString;
            servicePreferences.azureContainer = azureService.containerName;
          }
          
          // GCP Storage
          if (gcpService && gcpService.enabled) {
            servicePreferences.gcpEnabled = gcpService.enabled;
            servicePreferences.gcpBucket = gcpService.bucketName;
            servicePreferences.gcpServiceAccountKey = gcpService.serviceAccountKey;
          }
          
          // MinIO
          if (minioService && minioService.enabled) {
            servicePreferences.minioEnabled = minioService.enabled;
            servicePreferences.minioEndpoint = minioService.endpoint;
            servicePreferences.minioBucket = minioService.bucket;
            servicePreferences.minioAccessKey = minioService.accessKey;
            servicePreferences.minioSecretKey = minioService.secretKey;
            servicePreferences.minioRegion = minioService.region;
            servicePreferences.minioUseSSL = minioService.useSSL;
            servicePreferences.minioPort = minioService.port;
          }
          
          logger.info('Service preferences loaded:', {
            hasAWS: !!servicePreferences.awsS3Enabled,
            hasAzure: !!servicePreferences.azureEnabled,
            hasGCP: !!servicePreferences.gcpEnabled,
            hasMinio: !!servicePreferences.minioEnabled,
            minioEndpoint: servicePreferences.minioEndpoint,
            minioBucket: servicePreferences.minioBucket
          });
          
        } catch (error) {
          console.warn('Failed to get service preferences:', error);
        }
      }
      
      const sessionData = {
        session: null, // Upload session managed by renderer
        token: token,
        serverBaseUrl: sharedConfig.serverBaseUrl,
        appName: sharedConfig.appName,
        appVersion: sharedConfig.appVersion,
        clientId: sharedConfig.clientId,
        servicePreferences: servicePreferences,
        selectedService: fileServiceType
      };
      
      return sessionData;
      
    } catch (error) {
      console.error('Failed to generate session data:', error);
      // Return minimal session data to prevent complete failure
      return {
        session: null,
        token: null,
        serverBaseUrl: 'https://tmp.chph.dev',
        appName: 'com.chph.zentransfer',
        appVersion: '0.1.22',
        clientId: '4a276465-fbc2-4874-833d-966bd48c3ace',
        servicePreferences: {},
        selectedService: fileServiceType
      };
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
    
    // Generate session data for this upload
    const sessionData = await this.generateSessionData(file.service_type);
    
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
      },
      sessionData: sessionData
    });
    
    logger.info(`Started upload: ${file.filename} (jobId: ${jobId}, fileId: ${file.id})`);
    
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
    logger.info(`Creating upload worker ${id}...`);
    const workerPath = path.join(__dirname, '..', 'workers', 'UploadWorkerThread.js');
    logger.info(`Worker path: ${workerPath}`);
    
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
      logger.info(`Upload worker ${id} exited with code ${code}`);
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
    
    logger.info(`Upload worker ${id} created successfully`);
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
          
          logger.info(`Upload failed: ${job.file.filename} - ${message.error}`);
          
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
          
          logger.info(`Upload completed: ${job.file.filename}`);
          
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
          
          logger.info(`Upload worker error for ${job.file.filename}:`, error);
          
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
    logger.info('Cancelling all upload jobs...');
    
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
    this.backoffManager.reset();
    
    logger.info('All upload jobs cancelled');
    
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