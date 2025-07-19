/**
 * Upload Worker Pool
 * Manages a pool of worker threads for handling file uploads with SQLite queue
 * Extracted from main.js for better modularity
 */

const { BrowserWindow, app } = require('electron');
const { Worker } = require('worker_threads');
const { UploadQueue } = require('../queues/UploadQueue.js');
const { BackOffManager } = require('../services/BackOffManager.js');
const { CloudFactory } = require('../services/CloudFactory.js');
const { MimeTypesService } = require('../services/MimeTypesService.js');
const { DateFormatter } = require('../utils/DateFormatter.js');

const fs = require('fs');
const path = require('path');
const logger = require('../utils/Logger.js');
const mimeTypes = new MimeTypesService();

const USE_DEDUPE_CHECK = false;

class UploadWorkerPool {
  constructor(poolSize) {
    this.workers = [];
    this.activeJobs = new Map();
    
    // Initialize SQLite queue
    this.uploadQueue = new UploadQueue();
    
    // Reset any stuck "processing" files to "queued" on startup
    this.uploadQueue.resetProcessingFiles();

    // File backoff strategy
    this.fileBackoffManager = new BackOffManager(
      app.configurationManager.get('uploadSettings.fileBackoff.initialInterval'),
      app.configurationManager.get('uploadSettings.fileBackoff.maxInterval'),
      app.configurationManager.get('uploadSettings.fileBackoff.multiplier'),
      app.configurationManager.get('uploadSettings.fileBackoff.resetOnSuccess')
    );
    logger.info(`File backoff: ${this.fileBackoffManager.backoffConfig.initialInterval}, max: ${this.fileBackoffManager.backoffConfig.maxInterval}, multiplier: ${this.fileBackoffManager.backoffConfig.multiplier}`);

    // Some help with exponential backoffs when stuff go awry
    this.backOffManagers = new Map();
    const backoffConfig = app.configurationManager.get('uploadSettings.serviceBackoff');
    for (const serviceType of CloudFactory.listCloudServices()) {
      
      this.backOffManagers.set(serviceType, new BackOffManager(
        backoffConfig.initialInterval,
        backoffConfig.maxInterval, 
        backoffConfig.multiplier, 
        backoffConfig.resetOnSuccess));
    }
    logger.info(`Service backoff: ${backoffConfig.initialInterval}, max: ${backoffConfig.maxInterval}, multiplier: ${backoffConfig.multiplier}, reset on success: ${backoffConfig.resetOnSuccess}`);
    
    // Queue processing timer
    this.queueProcessingInterval = null;
    
    // Create worker pool
    for (let i = 0; i < poolSize; i++) {
      this.createWorker(i);
    }

    logger.info(`Upload worker pool initialized with ${poolSize} workers`);

    // We start by default on startup
    this.startProcessing();
    
    logger.info('Upload worker is ready to go and eating the queue if theres any.');
  }

  getBackOffManager(serviceType) {
    return this.backOffManagers.get(serviceType);
  }
  
  /**
   * Worker management
   */
  
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
    });
    
    worker.on('exit', (code) => {
      logger.error(`Upload worker ${id} exited with code ${code}`);
    });
    
    this.workers.push({
      worker,
      id,
      currentJob: null
    });
    
    logger.info(`Upload worker ${id} created successfully`);
  }
  
  handleWorkerMessage(worker, message) {
    const { type, fileRecord } = message;

    // Look up my worker in the workers array
    const myWorker = this.workers.find(w => w.worker === worker);

    if (!myWorker) {
      throw new Error(`Upload worker ${worker} not found in workers array`);
    }
    
    if (type === 'progress') {

      // Forward progress updates to renderer (in-memory only)
      this.sendMessageToRendererWindows('upload-progress', fileRecord);

    } else {

      // worker is done with the job, free them up for the next one
      myWorker.currentJob = null;

      if (type === 'completed') {
        this.sendMessageToRendererWindows('upload-update', fileRecord);

        if ( fileRecord.status === 'completed' ) {
          this.uploadQueue.completeUpload(fileRecord.id, fileRecord.final_url);

          const backoffManager = this.getBackOffManager(fileRecord.service_type);
          if ( backoffManager ) {
            backoffManager.onSuccess();
          } else {
            logger.error(`Backoff manager not found for service type: ${fileRecord.service_type}`);
          }

          // Add to dedupe
          const sourceBaseName = path.basename(fileRecord.source_path);
          this.uploadQueue.addDupe(sourceBaseName, fileRecord.file_size, fileRecord.file_date, null, null, fileRecord.service_type);

          // TBD: Add to index_queue, ledger_queue, registry

          // We could poll the queue here and give to the worker if there is any
          // instead of waiting for the timer to run, will make sure we keep momentum
          // TBD

        } else if ( message.status === 'failed' ) {

          // Notify backoff manager to ease up on this service
          this.getBackOffManager(fileRecord.serviceType).onFailure();

          if ( fileRecord.retry_count < app.configurationManager.get('uploadSettings.maxRetries') ) {

            this.uploadQueue.retryUpload(fileRecord.id);
            this.getBackOffManager(fileRecord.service_type).onFailure();

            this.sendMessageToRendererWindows('upload-update', { ...fileRecord, status: 'retry' });

          } else {

            this.uploadQueue.failUpload(fileRecord.id, fileRecord.error_message);

            this.sendMessageToRendererWindows('upload-update', {...fileRecord, status: 'failed'});
            
          }
        } 

      } else if ( type === 'update-info-cache' ) {

        const { source_path, file_size, file_date, checksumMd5, checksumSHA256, checksumSHA512,tiny_thumb, thumbnail, preview, exif } = message.fileRecord;
        //console.log("Updating info cache:", source_path, file_size, file_date, checksumMd5, checksumSHA256, checksumSHA512, exif);

        /*  type: 'update-info-cache',
              fileRecord: {
                  source_path: filePath,
                  file_size: fs.statSync(filePath).size,
                  checksumMd5: fileHashes.md5,
                  checksumSHA256: fileHashes.sha256,
                  checksumSHA512: fileHashes.sha512,
                  tiny_thumb: tinyThumb,
                  thumbnail: thumbnail,
                  preview: preview,
                  exif: JSON.stringify(metadataResult.metadata)
              }
        */

        this.uploadQueue.addToCache(
          source_path, 
          file_size, 
          file_date, 
          checksumMd5, 
          checksumSHA256, 
          checksumSHA512, 
          tiny_thumb, 
          thumbnail, 
          preview, 
          exif)

      } else if ( type === 'log' ) {

        const { level, args } = message;
        logger[level](`[WORKER ${myWorker.id}] ${args[0]}`);

      } else {

        logger.error(`Unknown message type: ${type}`);
      }
    }
  }
  
  sendMessageToRendererWindows(message, data = null) {
    // Send progress update to all renderer processes
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(message, data);
    });
  }
  
  /**
   * Queue processing
   */

  startProcessing() {

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
  
  pauseProcessing() {
    if (this.queueProcessingInterval) {

      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;

      logger.info('Paused upload processing.');
    }
  }

  findFileToProcess(readyFiles) {

    for (const file of readyFiles) {

      // First check if we're backing off from this specific service
      if (this.getBackOffManager(file.service_type).isInBackoff()) {
        continue;
      }

      // Is this a dupe?
      if ( USE_DEDUPE_CHECK ) {
        const sourceBaseName = path.basename(file.source_path);
        if ( this.uploadQueue.checkForDupeWithService(sourceBaseName, file.file_size, file.file_date, file.service_type) ) {

          this.uploadQueue.markAsDupe(file.id);
          this.sendMessageToRendererWindows('upload-update', { ...file, status: 'dupe' });

          continue;
        }
      }

      // Now check if it is time to retry this file (we have default much longer backoff for individual files)
      if ( file.retry_count > 0 ) {
        const backoffTime = BackOffManager.calculate(file.retry_count, this.fileBackoffManager.backoffConfig);
        const lastRetryTime = new Date(file.last_retry_at);
        if ( lastRetryTime.getTime() + backoffTime > Date.now() ) {
          continue;
        }
      }

      // If we get here, it's not a dupe, so we can process it
      return file;
    }

    return null;
  }
  
  async processQueue() {
    
    // Get available workers and ready files
    const availableWorkers = this.workers.filter(w => !w.currentJob);
    if (availableWorkers.length === 0) return;
    
    let readyFiles = this.uploadQueue.getQueuedFiles();
    if (readyFiles.length === 0) return;
    
    logger.info(`Processing upload queue: ${availableWorkers.length} available workers, ${readyFiles.length} ready files`);
    
    // Start uploads for available workers
    for (let i = 0; i < Math.min(availableWorkers.length, readyFiles.length); i++) {

      const worker = availableWorkers[i];
      const file = this.findFileToProcess(readyFiles);
      if (!file) return; // no files not in backoff

      await this.submitUploadJobToWorkerThread(worker, file);

      // Remove the file from the ready files list
      readyFiles = readyFiles.filter(f => f.id !== file.id);

    }

  }

  async submitUploadJobToWorkerThread(workerInfo, file) {

    // Update database to mark as processing
    this.uploadQueue.startUpload(file.id);

    // Do we need to create or refresh the session?
    if ( file.service_type == 'zentransfer' ) {
      if ( app.uploadSession.isSessionExpired() ) {
        await app.uploadSession.createUploadSession();
      }
    }

    // Prepare the current configuration
    const configuration = app.configurationManager.exportConfig();
    configuration.uploadSession = app.uploadSession.session;
    //console.log("Exported configuration:", configuration);
    
    // Mark worker as busy
    workerInfo.currentJob = file;
    
    // Send to worker
    workerInfo.worker.postMessage({
      type: 'upload-file',
      fileRecord: file,
      configuration: configuration,
      globals: app.globals
    });
    
    logger.info(`Started upload: ${file.source_path} (fileId: ${file.id})`);
    
    // Send progress update to renderer
    this.sendMessageToRendererWindows('upload-update', file);
  }
  

  /**
   * External control - add and cancel jobs
   */

  addFiles(filenames, serviceType) {

    console.log('Adding files to upload queue:', filenames);

    if (!this.uploadQueue) {
      throw new Error('Database has been closed.');
    }

    let inputRecords = [];
    for (const filename of filenames) {

      const fileStats = fs.statSync(filename);
      
      if ( fileStats.isDirectory() ) {

        console.log('Adding directory, recursively, to upload queue:', filename);
        inputRecords = inputRecords.concat(this.recursivelyAddFiles(filename, serviceType));

      } else if ( !fileStats.isFile() ) {

        logger.warn(`Skipping non-file: ${filename}`);
        continue;

      } else {

        inputRecords.push(this.createFileRecord(filename, fileStats, serviceType));
        
      }
    }

    console.log('Adding files to upload queue:', inputRecords.length);
    this.uploadQueue.addFiles(inputRecords);
  }

  recursivelyAddFiles(directoryName, serviceType) {

    let inputRecords = [];

    const fileStats = fs.statSync(directoryName);
    if ( fileStats.isDirectory() ) {
      console.log(`IsDirectory: ${directoryName}, traversing...`);
      fs.readdirSync(directoryName).forEach(file => {
        const filePath = path.join(directoryName, file);
        inputRecords = inputRecords.concat(this.recursivelyAddFiles(filePath, serviceType));
      });
    } else if ( fileStats.isFile() ) {
      //console.log("IsFile:", directoryName);
      inputRecords.push(this.createFileRecord(directoryName, fileStats, serviceType));
    }

    //console.log("Returning inputRecords:", inputRecords.length);
    return inputRecords;
  }


  // create the record for the queue

  createFileRecord(sourcePath, fileStats, serviceType) {

    const record = {
      source_path: sourcePath,
      remote_path: path.basename(sourcePath),
      file_size: fileStats.size,
      file_date: fileStats.mtime,
      mime_type: mimeTypes.getMimeType(sourcePath),
      service_type: serviceType
    };

    return record;

  }

  cancelJob(jobId) {
    if (!this.uploadQueue) {
      throw new Error('Database has been closed.');
    }

    this.uploadQueue.cancelUpload(jobId);
  }
  
  getStats() {
    if (!this.uploadQueue) {
      throw new Error('Database has been closed.');
    }

    return this.uploadQueue.getStats();
  }

  cancelAllJobs() {
    if (!this.uploadQueue) {
      throw new Error(' ');
    }

    this.uploadQueue.clearAll();
  }
  
  getQueuedFiles() {
    return this.uploadQueue.getQueuedFiles();
  }
  
  async close() {
    this.pauseProcessing();

    // Terminate all workers
    for (const workerInfo of this.workers) {
      await workerInfo.worker.terminate();
    }
    this.workers = [];

    // Close the queue and compact the database
    if (this.uploadQueue) {
      this.uploadQueue.close();
      this.uploadQueue = null;
    }
  }

}

module.exports = { UploadWorkerPool };