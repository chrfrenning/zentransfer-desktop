/**
 * Download Worker Manager
 * Manages download worker threads for handling file download operations
 * Now with SQLite-based persistent queue and retry logic
 */

const { BrowserWindow, app } = require('electron');
const { Worker } = require('worker_threads');
const logger = require('../utils/Logger.js');
const path = require('path');

const { DownloadQueue } = require('../queues/DownloadQueue.js');
const { BackOffManager } = require('../services/BackOffManager.js');



class DownloadWorkerPool {
  constructor(poolSize = 3) {
    this.poolSize = poolSize;
    this.workers = [];
    this.isMonitoring = false;
    this.queueProcessingInterval = null; // Timer for processing queue every second
    this.newFilePollingInterval = null; // Timer for checking new files every second
    this.pollNextTimeZeroInQueue = false; // If true, poll the server immediately when the queue is empty

    // Exponential backoff for server polling
    this.backoffConfig = app.configurationManager.get('downloadSettings.downloadBackoff');
    this.backOffManager = new BackOffManager(
      this.backoffConfig.initialInterval, 
      this.backoffConfig.maxInterval, 
      this.backoffConfig.multiplier, 
      false);

    // SQLite queue manager
    this.queueManager = null;

    // Create workers (number configurable via config)
    logger.debug("Starting download workers...");
    this.createWorkers();

    // Initialize our queue database
    logger.debug("Initializing download queue...");
    this.initializeQueue();

    logger.info('DownloadWorkerPool is ready to go!');
  }



  /**
   * Initialize queue manager
   */

  initializeQueue() {
    if (!this.queueManager) {
      this.queueManager = new DownloadQueue();
      this.queueManager.initialize();

      // Reset any files that were downloading when app shut down
      this.queueManager.resetAllPending();

      // We're ready to roll
      logger.info('Download queue manager initialized');
    }
  }



  /**
   * Create download workers
  */

  createWorkers() {
    // Get worker count from config or default to 3
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker(i);
    }

    logger.info(`Download worker manager initialized with ${this.poolSize} workers`);
  }

  createWorker(id) {
    logger.info(`Creating download worker ${id}...`);
    const workerPath = path.join(__dirname, '../workers', 'DownloadWorkerThread.js');

    const worker = new Worker(workerPath, {
      workerData: { workerId: id }
    });

    worker.on('message', (message) => {
      this.handleWorkerMessage(worker, message);
    });

    worker.on('error', (error) => {
      logger.error(`Download worker ${id} error:`, error);
    });

    worker.on('exit', (code) => {
      logger.error(`Download worker ${id} exited with code ${code}`);
    });

    this.workers.push({
      worker,
      id,
      currentFileId: null
    });

    logger.info(`Download worker ${id} created successfully`);
  }


  /**
   * Handle messages from the download workers
   */

  async handleWorkerMessage(worker, message) {
    // The message
    const { type, fileRecord } = message;

    // Look up my worker in the workers array
    const myWorker = this.workers.find(w => w.worker === worker);

    switch (type) {

      case 'progress':
        const { downloadedBytes, totalBytes } = message;
        logger.debug(`Downloading ${fileRecord.name} ${downloadedBytes}/${totalBytes} bytes`);
        this.sendMessageToRendererWindows('download-progress', message);
        break;

      case 'completed':
        logger.debug(`Received completed from worker ${worker.id}`, message);
        this.sendMessageToRendererWindows('download-completed', message);

        const { filePath } = message;
        this.queueManager.markFileAsCompleted(fileRecord.file_id, filePath);

        myWorker.currentFileId = null;

        break;

      case 'error':
        logger.debug(`Received error from worker ${worker.id}`, message);
        this.sendMessageToRendererWindows('download-error', message);
        
        this.queueManager.markFileAsFailed(fileId, message.errorMessage);

        worker.currentFileId = null;
        break;

      case 'worker-error':
        const { error, stack } = message;
        console.error(`Received worker-error from worker ${worker.id}`, fileRecord, error, stack);
        break;

      case 'log':
        //console.log('Received log from worker', message);
        const { level, args } = message;
        logger[level](`[WORKER ${myWorker.id}] [${level}] ${args[0]}`);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  sendMessageToRendererWindows(message, data = null) {
    BrowserWindow.getAllWindows().forEach(window => {
      if (window && !window.isDestroyed() && window.webContents && !window.webContents.isDestroyed()) {
        window.webContents.send(message, data);
      }
    });
  }



  /**
   * Monitor by polling the server for new files
   */

  async startMonitoring() {
    if (this.isMonitoring) {
      throw new Error('Monitoring already in progress');
    }

    logger.info(`Starting download monitoring`);
    this.isMonitoring = true;

    // Set up our timers to control workers and poll server
    this.startTimers();

    // Send update to renderer about monitoring starting
    this.sendMessageToRendererWindows('download-monitoring-started');
  }

  stopMonitoring() {
    logger.info('Stopping download monitoring...');

    // Clear our timers

    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
    }

    if (this.newFilePollingInterval) {
      clearInterval(this.newFilePollingInterval);
      this.newFilePollingInterval = null;
    }

    this.isMonitoring = false;

    // Send update to renderer about monitoring stopping
    this.sendMessageToRendererWindows('download-monitoring-stopped');
  }

  /**
   * Start the two monitoring timers
   * 
   * We have one timer that looks at the workers and see if they are free,
   * if so, it queries the database for files that are pending, and submits
   * to available workers.
   * 
   * The second is checking if there is time to go to the server and poll
   * for new files. We're using an exponential backoff to avoid hammering the
   * server, but it is reset when we find new files. We also reset it if
   * there is user activity in the UI (mouse, keyboard).
   * 
  */

  startTimers() {
    // Timer 1: Process queue every second
    this.queueProcessingInterval = setInterval(async () => {
      if (!this.isMonitoring) return;
      try {
        await this.processQueueTikTok();
      } catch (error) {
        console.error('Error in queue processing timer:', error);
      }
    }, 1000);

    // Timer 2: Check for new files every second (with condition)
    this.newFilePollingInterval = setInterval(async () => {
      if (!this.isMonitoring) return;
      try {
        await this.checkForNewFilesTikTok();
      } catch (error) {
        console.error('Error in new file polling timer:', error);
      }
    }, 1000);

    logger.info('Started two monitoring timers: queue processing and new file polling');
  }


  /* Process the queue */

  async processQueueTikTok() {
    // Start downloads for available workers
    const availableWorkers = this.workers.filter(w => !w.currentFileId);
    const readyFiles = this.queueManager.getPendingFiles();

    logger.info(`Processing queue: ${availableWorkers.length} available workers, ${readyFiles.length} pending files`);

    if (readyFiles.length === 0) {
      if (this.pollNextTimeZeroInQueue) {
        this.pollNextTimeZeroInQueue = false;
        this.backOffManager.reset();
      }
      return;
    }

    for (let i = 0; i < Math.min(availableWorkers.length, readyFiles.length); i++) {
      const worker = availableWorkers[i];
      const file = readyFiles[i];

      logger.debug(`Starting download for worker ${worker.id} and file ${file.file_id}`);
      await this.startDownload(worker, file);
    }
  }

  async startDownload(workerInfo, file) {
    workerInfo.currentFileId = file.file_id;

    // Update database
    this.queueManager.markFileAsProcessing(file.file_id);
    const downloadPath = app.configurationManager.get('downloadSettings.downloadPath');

    workerInfo.worker.postMessage({
      type: 'download-file',
      fileRecord: file,
      downloadPath: downloadPath
    });

    logger.info(`Started download: ${file.name}`);

    // Send immediate notification that download started
    this.sendMessageToRendererWindows('download-started', file);
  }


  /* Check for new files */

  async checkForNewFilesTikTok() {
    // Do not poll the server as long as we have files to process
    if (this.queueManager.getPendingFiles().length > 0) {
      return;
    }

    // Check exponential backoff - only call server if enough time has passed
    if (this.backOffManager.isInBackoff()) {
      return;
    }

    try {
      logger.info(`Checking for new files `);
      this.sendMessageToRendererWindows('download-monitoring-check');

      const newFiles = await this.fetchNewFilesFromServer();

      if ( newFiles.length > 0 ) {
        logger.info(`Found ${newFiles.length} new files - resetting backoff`);

        // Reset backoff when files are found
        this.backOffManager.reset();

        // Add files to database queue
        const addResults = this.queueManager.addFiles(newFiles);

      } else {

        logger.info('No new files found - increasing backoff');
        this.backOffManager.increase();

      }

    } catch (error) {

      console.error('Error checking for new files:', error);
      this.sendMessageToRendererWindows('download-monitoring-error', error.message);
      this.backOffManager.onFailure();

    }
  }

  async fetchNewFilesFromServer() {
    try {
      // Use the latest downloaded file time if available, otherwise use the initial sync time
      const syncTime = this.queueManager.getMaxCreatedAt();
      logger.info(`Checking server for files since: ${syncTime}`);

      // Get authentication token from token manager
      const authToken = await app.tokenManager.getValidToken();
      if (!authToken) {
        throw new Error('No valid authentication token available for download monitoring');
      }

      console.log("Server URL: ", app.globals.serverBaseUrl);

      // Make actual API call to ZenTransfer server
      const isoTimeString = syncTime.toISOString();
      const response = await fetch(`${app.globals.serverBaseUrl}/api/sync?since=${encodeURIComponent(isoTimeString)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}: ${response.statusText}`);
      }

      // Get the files from the response
      const files = await response.json();
      logger.info(`Found ${files.length} new files from server`);

      return files;

    } catch (error) {

      console.error('Failed to fetch new files from server:', error);
      throw error;

    }
  }
  
  /**
   * Notifications from above
   */

  onUserActivitySignal() {
    this.backOffManager.reset();
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

module.exports = { DownloadWorkerPool }; 