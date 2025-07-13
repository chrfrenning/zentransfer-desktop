/**
 * Upload Worker Pool
 * Manages a pool of worker threads for handling file uploads
 * Extracted from main.js for better modularity
 */

const { BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');

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

module.exports = { UploadWorkerPool }; 