/**
 * Import Worker Manager
 * Manages import worker thread for handling file import operations
 * Extracted from main.js for better modularity
 */

const { BrowserWindow, app } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('../utils/Logger.js');

const { UploadQueue } = require('../queues/UploadQueue.js');
const { DirectoryScanner } = require('../utils/DirectoryScanner.js');
const { HighWaterMark } = require('../utils/HighWaterMark.js');
const { MimeTypesService } = require('../services/MimeTypesService.js');

const MAX_POOL_SIZE = 1;

class ImportWorkerPool {
  constructor(poolSize) {

    poolSize = Math.min(poolSize, MAX_POOL_SIZE);

    // We need to understand mime types
    this.allMimeTypes = new MimeTypesService();
    this.rawFileMimeTypes = new MimeTypesService('rawfiles.types');

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
    }, 250);
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

    logger.info(`Files in queue: ${this.fileQueue.length}`);

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
    
    if (type === 'completed') {

      //console.log("!!!", message);

      // Forward progress and log updates to renderer
      const { success, result, file } = message;

      if ( success ) {

        if ( result.operation === 'skipped' ) {

          logger.info(`Import worker ${myWorker.id} skipped import of: ${file.name}`);

        } else if ( result.operation === 'completed' ) {

          logger.info(`Import worker ${myWorker.id} completed import of: ${file.name}`);

          this.uploadQueue.addDupe(file.name, file.size, file.modified.toISOString(), null, null, 'import');

        }

        this.sendMessageToRendererWindows('import-update', file.name);
      }

      myWorker.currentJob = null;
      this.processQueue();

    } else if ( type === 'post-to-upload' ) {
      
      const { filename, service } = message;
      app.uploadWorkerPool.addFiles([filename], service);

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
      organizeIntoFolders: 'none', // none|date|custom, if custom use prefixFolderName
      dateFormat: 'YYYY/YYYY-MM-DD', // see DateFormatter.js for supported formats
      prefixFolderName: null,
      postFixFolderName: null,
      enableBackup: false,
      backupPath: 'D:\\ZenTransfer Test\\ZT Backup',
      enabledServices: [ /* 'minio', 'zentransfer' */ ],
      ignoreDupes: false,
      ...importJob
    }

    logger.info('Starting import...');

    const scanner = new DirectoryScanner();
    const files = await scanner.scan(settings.sourcePath, true, null);
    logger.info(`Found ${files.length} files to import`);

    const stats = {
      totalFiles: files.length,
      filteredOut: 0,
      duplicates: 0
    };

    // Submit these files to the worker pool
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date();
    startOfYesterday.setHours(0, 0, 0, 0);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const existingHighWateMark = await HighWaterMark.getHighWaterMarkDate(settings.sourcePath);

    for (const file of files) {

      // We're counting, 1..2..3..
      stats.totalFiles++;


      // Check if the file time

      if ( settings.importTimeFilter === 'today' ) {

        if ( file.created < startOfToday ) {
          stats.filteredOut++;
          continue;
        }

      } else if ( settings.importTimeFilter === 'yesterday' ) {

        if ( file.created < startOfYesterday ) {
          stats.filteredOut++;
          continue;
        }

      } else if ( settings.importTimeFilter === 'highWaterMark' ) {

        if ( file.created < existingHighWateMark ) {
          stats.filteredOut++;
          continue;
        }

      }


      // Check if it matches the import type filer

      const mimeType = this.allMimeTypes.getMimeType(file.name);
      if ( settings.importTypeFilter === 'imageFiles' ) {

        if ( !mimeType.startsWith('image/') ) {
          stats.filteredOut++;
          continue;
        }

      } else if ( settings.importTypeFilter === 'jpegOnly' ) {

        if ( !mimeType.startsWith('image/jpeg') ) {
          stats.filteredOut++;
          continue;
        }

      } else if ( settings.importTypeFilter === 'rawOnly' ) {

        if ( !this.rawFileMimeTypes.isKnown(mimeType) ) {
          stats.filteredOut++;
          continue;
        }

      }

      // If the file is a duplicate, skip it

      if ( settings.ignoreDupes ) {

        const isDupe = this.uploadQueue.checkForDupeWithService(file.name, file.size, file.modified.toISOString(), 'import');

        if ( isDupe ) {
          stats.duplicates++;
          continue;
        }

      }

      // We're good, the file will be worked on
      this.fileQueue.push({file, settings});
    }

    // We cannot update the high water mark until we know if the job
    // will be cancelled. Only if the job is allowed to complete we
    // can know what the highest file time is...

    if ( !scanner.isCancelled ) {

      const highestFileTime = files.reduce((max, file) => {
        return Math.max(max, file.created);
      }, HighWaterMark.beginningOfTime());

      const hwm = new HighWaterMark();
      await hwm.upsert(settings.sourcePath, highestFileTime);

      logger.info(`Updated high water mark to ${highestFileTime}`);

    }

    logger.info(`Import stats: ${stats.totalFiles} files, ${stats.filteredOut} filtered out, ${stats.duplicates} duplicates`);
  }
  
  stopImport() {
    logger.info("Stopping import...");
    this.fileQueue = [];
  }
}

module.exports = { ImportWorkerPool }; 