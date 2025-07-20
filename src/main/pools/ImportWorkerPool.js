/**
 * Import Worker Manager
 * Manages import worker thread for handling file import operations
 * Extracted from main.js for better modularity
 */

const { BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('../utils/Logger.js');

const { UploadQueue } = require('../queues/UploadQueue.js');
const { DirectoryScanner } = require('../utils/DirectoryScanner.js');

class ImportWorkerPool {
  constructor(poolSize) {

    // We need to interact with the upload subsystem
    // and also check for dupes
    this.uploadQueue = new UploadQueue();

    // Create the workers
    this.workers = [];
    this.activeJobs = new Map();

    for (let i = 0; i < poolSize; i++) {
      this.createWorker(i);
    }

    // Hmmm... do we want a queue for the individual files to be copied/processed?
    // Use db, or just a simple array?
    this.fileQueue = [];
    this.queueProcessorInterval = null;
    this.startQueueProcessor();
    
    logger.info('Import worker manager initialized');
  }

  /**
   * Queue management
   */
  
  startQueueProcessor() {
    this.queueProcessorInterval = setInterval(async() => {
      await this.processQueue();
    }, 1000);
  }

  /* processQueue() {
    if (this.fileQueue.length === 0) {
      logger.info('No files to process');
    }

    logger.info(`Processing ${this.fileQueue.length} files`);
  } */
  
  async processQueue() {

    if ( this.fileQueue.length === 0 ) {
      return;
    }
    
    // Get available workers and ready files
    const availableWorkers = this.workers.filter(w => !w.currentJob);
    if (availableWorkers.length === 0) return;
    
    logger.info(`Import queue: ${availableWorkers.length} available workers, ${this.fileQueue.length} files in queue.`);
    
    // Start uploads for available workers
    for (let i = 0; i < Math.min(availableWorkers.length, this.fileQueue.length); i++) {

      const worker = availableWorkers[i];
      await this.submitJobToWorkerThread(worker, this.fileQueue.pop());
    }

  }
  
  async submitJobToWorkerThread(workerInfo, file) {

    // Mark worker as busy
    workerInfo.currentJob = file;
    
    // Send to worker
    workerInfo.worker.postMessage({
      type: 'import-file',
      file: file,
      configuration: app.configurationManager.exportConfig()
    });
    
    logger.debug(`Started import of: ${file.sourcePath}`);
    
    // Send progress update to renderer
    this.sendMessageToRendererWindows('import-update', file);

  }

  /**
   * Worker management
   */
  
  createWorker(id) {
    logger.info(`Creating import worker ${id}...`);
    const workerPath = path.join(__dirname, '../workers', 'ImportWorkerThread.js');
    
    const worker = new Worker(workerPath, {
      workerData: { workerId: id }
    });
    
    worker.on('message', (message) => {
      this.handleWorkerMessage(worker, message);
    });
    
    worker.on('error', (error) => {
      console.error('Import worker error:', error);
    });
    
    worker.on('exit', (code) => {
      logger.info(`Import worker exited with code ${code}`);
    });

    this.workers.push({
      worker,
      id,
      currentJob: null
    });
    
    logger.info('Import worker created successfully');
  }
  
  handleWorkerMessage(worker, message) {
    const { type } = message;
    
    // Look up my worker in the workers array
    const myWorker = this.workers.find(w => w.worker === worker);

    logger.info('Import worker message:', type);
    
    if (type === 'progress') {

      // Forward progress and log updates to renderer
      this.sendMessageToRendererWindows('import-update', message);

    } else if ( type === 'log' ) {

      //logger.info('Import worker log:', message);
      const { level, args } = message;
      logger[level](`[WORKER ${myWorker.id}] ${args[0]}`);

    }
  }
  
  sendMessageToRendererWindows(message, data = null) {
    // Send progress update to all renderer processes
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(message, data);
    });
  }

  /**
   * Import management
   */
  
  async startImport(importJob) {
    const settings = {
      sourcePath: 'D:\\ZenTransfer Test\\ZT Source',
      includeSubdirectories: true,
      importTypeFilter: 'allFiles', // allFiles|imageFiles|jpegOnly|rawOnly
      importTimeFilter: 'allTime', // allTime|today|yesterday|highWaterMark
      destinationPath: 'D:\\ZenTransfer Test\\ZT Import',
      organizeIntoFolders: 'date', // date|custom
      dateFormat: 'ldn (tod)', // see DateFormatter.js for supported formats
      prefixFolderName: 'My Folder Name',
      postFixFolderName: null,
      enableBackup: false,
      backupPath: 'D:\\ZenTransfer Test\\ZT Backup',
      enabledServices: [ 'minio', 'zentransfer' ],
      ...importJob
    }

    logger.info('Starting import...');
    const scanner = new DirectoryScanner();
    const files = await scanner.scan(settings.sourcePath, true, null);
    logger.info(`Found ${files.length} files to import`);
    //this.fileQueue = files;
  }
  
  stopImport() {
    logger.info("Stopping import...");
    this.fileQueue = [];
  }
}

module.exports = { ImportWorkerPool }; 