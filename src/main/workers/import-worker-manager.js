/**
 * Import Worker Manager
 * Manages import worker thread for handling file import operations
 * Extracted from main.js for better modularity
 */

const { BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');

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
    const workerPath = path.join(__dirname, '../../workers/import', 'import-worker-main.js');
    
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
    
    if (importSettings?.uploadToMinio) {
      uploadServices.push({ type: 'minio', name: 'MinIO' });
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

module.exports = { ImportWorkerManager }; 