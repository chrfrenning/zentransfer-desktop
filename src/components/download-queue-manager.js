/**
 * Download Queue Manager
 * Manages the queue of files to be downloaded
 */

import { StorageManager } from './storage-manager.js';
import { UIComponents } from './ui-components.js';

export class DownloadQueueManager {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.currentDownload = null;
        this.downloadPath = null;
        this.onQueueUpdate = null;
        this.onDownloadProgress = null;
        
        // Load persisted queue
        this.loadQueue();
    }

    /**
     * Load queue from storage
     */
    loadQueue() {
        this.queue = StorageManager.getDownloadQueue();
        this.downloadPath = StorageManager.getDownloadPath();
    }

    /**
     * Save queue to storage
     */
    saveQueue() {
        StorageManager.setDownloadQueue(this.queue);
    }

    /**
     * Add files to download queue
     * @param {Array} files - Array of file objects
     */
    addFiles(files) {
        console.log('Queue manager addFiles called with:', files);
        
        const newFiles = files.filter(file => 
            !this.queue.some(queuedFile => queuedFile.id === file.id)
        );

        console.log('New files to add (after filtering):', newFiles);

        newFiles.forEach(file => {
            this.queue.push({
                ...file,
                status: 'queued',
                addedAt: new Date().toISOString(),
                progress: 0
            });
        });

        console.log('Queue after adding files:', this.queue);

        this.saveQueue();
        this.notifyQueueUpdate();

        if (newFiles.length > 0) {
            UIComponents.Notification.show(`Added ${newFiles.length} file(s) to download queue`, 'success');
            
            // Start processing if not already processing
            if (!this.isProcessing) {
                console.log('Starting processing after adding new files');
                this.startProcessing().catch(error => {
                    console.error('Failed to start processing:', error);
                });
            }
        } else {
            console.log('No new files to add (all already in queue)');
        }
    }

    /**
     * Remove file from queue
     * @param {string} fileId - File ID to remove
     */
    removeFile(fileId) {
        this.queue = this.queue.filter(file => file.id !== fileId);
        this.saveQueue();
        this.notifyQueueUpdate();
    }

    /**
     * Clear completed downloads from queue
     */
    clearCompleted() {
        this.queue = this.queue.filter(file => file.status !== 'completed');
        this.saveQueue();
        this.notifyQueueUpdate();
    }

    /**
     * Clear all files from queue
     */
    clearAll() {
        this.queue = [];
        this.saveQueue();
        this.notifyQueueUpdate();
    }

    /**
     * Start processing the download queue
     */
    async startProcessing() {
        console.log('startProcessing called, isProcessing:', this.isProcessing);
        
        if (this.isProcessing) return;
        
        if (!this.downloadPath) {
            throw new Error('Download path not set. Please configure download directory.');
        }

        console.log('Starting queue processing, queue length:', this.queue.length);
        this.isProcessing = true;
        
        while (this.queue.length > 0 && this.isProcessing) {
            const nextFile = this.queue.find(file => file.status === 'queued');
            console.log('Next file to download:', nextFile);
            
            if (!nextFile) {
                console.log('No queued files found, breaking');
                break;
            }

            try {
                await this.downloadFile(nextFile);
            } catch (error) {
                console.error('Download failed:', error);
                this.updateFileStatus(nextFile.id, 'failed', error.message);
            }
        }

        console.log('Queue processing finished');
        this.isProcessing = false;
        this.currentDownload = null;
    }

    /**
     * Stop processing the download queue
     */
    stopProcessing() {
        this.isProcessing = false;
        
        if (this.currentDownload) {
            this.updateFileStatus(this.currentDownload.id, 'queued');
            this.currentDownload = null;
        }
    }

    /**
     * Download a single file
     * @param {Object} file - File object to download
     */
    async downloadFile(file) {
        console.log('Starting download for file:', file);
        
        this.currentDownload = file;
        this.updateFileStatus(file.id, 'downloading');

        try {
            // Check what URL properties are available
            console.log('File properties:', Object.keys(file));
            console.log('File url:', file.url);
            console.log('File download_url:', file.download_url);
            
            // Use the appropriate URL property
            const downloadUrl = file.download_url || file.url;
            
            if (!downloadUrl) {
                throw new Error('No download URL found for file');
            }
            
            console.log('Using download URL:', downloadUrl);
            
            // Download the file
            await this.performDownload(downloadUrl, file);
            
            // Mark as completed and update last downloaded file
            this.updateFileStatus(file.id, 'completed');
            StorageManager.setLastDownloadedFile({
                id: file.id,
                name: file.name,
                created: file.created,
                downloadedAt: new Date().toISOString()
            });

            // Update last sync time to this file's creation time
            if (file.created) {
                StorageManager.setLastSyncTime(file.created);
            }

        } catch (error) {
            console.error('Download failed for file:', file.name, error);
            this.updateFileStatus(file.id, 'failed', error.message);
            throw error;
        }
    }

    /**
     * Perform the actual file download
     * @param {string} downloadUrl - URL to download from
     * @param {Object} file - File information
     */
    async performDownload(downloadUrl, file) {
        return new Promise(async (resolve, reject) => {
            try {
                // Check if we're in Electron environment
                if (typeof require !== 'undefined') {
                    // Electron environment - download directly to file system
                    const fs = require('fs');
                    const path = require('path');
                    const https = require('https');
                    const http = require('http');
                    
                    // Determine the full file path
                    const fileName = this.sanitizeFileName(file.name);
                    const filePath = path.join(this.downloadPath, fileName);
                    
                    console.log('Downloading to:', filePath);
                    
                    // Create write stream
                    const fileStream = fs.createWriteStream(filePath);
                    
                    // Choose appropriate module based on URL protocol
                    const client = downloadUrl.startsWith('https:') ? https : http;
                    
                    // Make the request
                    const request = client.get(downloadUrl, (response) => {
                        if (response.statusCode !== 200) {
                            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                            return;
                        }
                        
                        // Pipe the response to the file
                        response.pipe(fileStream);
                        
                        fileStream.on('finish', () => {
                            fileStream.close();
                            console.log('File downloaded successfully:', filePath);
                            resolve();
                        });
                        
                        fileStream.on('error', (err) => {
                            fs.unlink(filePath, () => {}); // Delete partial file
                            reject(err);
                        });
                    });
                    
                    request.on('error', (err) => {
                        reject(err);
                    });
                    
                    request.setTimeout(30000, () => {
                        request.abort();
                        reject(new Error('Download timeout'));
                    });
                    
                } else {
                    // Fallback for web environment
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = file.name;
                    link.style.display = 'none';
                    
                    document.body.appendChild(link);
                    link.click();
                    
                    setTimeout(() => {
                        document.body.removeChild(link);
                        resolve();
                    }, 100);
                }
                
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Sanitize filename for file system
     * @param {string} fileName - Original filename
     * @returns {string} Sanitized filename
     */
    sanitizeFileName(fileName) {
        // Remove or replace invalid characters for file systems
        return fileName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
    }

    /**
     * Update file status in queue
     * @param {string} fileId - File ID
     * @param {string} status - New status
     * @param {string} error - Error message if failed
     */
    updateFileStatus(fileId, status, error = null) {
        const file = this.queue.find(f => f.id === fileId);
        if (file) {
            file.status = status;
            file.error = error;
            file.updatedAt = new Date().toISOString();
            
            this.saveQueue();
            this.notifyQueueUpdate();
        }
    }

    /**
     * Set download path
     * @param {string} path - Download directory path
     */
    setDownloadPath(path) {
        this.downloadPath = path;
        StorageManager.setDownloadPath(path);
    }

    /**
     * Get queue statistics
     * @returns {Object} Queue statistics
     */
    getStats() {
        const total = this.queue.length;
        const completed = this.queue.filter(f => f.status === 'completed').length;
        const failed = this.queue.filter(f => f.status === 'failed').length;
        const queued = this.queue.filter(f => f.status === 'queued').length;
        const downloading = this.queue.filter(f => f.status === 'downloading').length;

        return {
            total,
            completed,
            failed,
            queued,
            downloading,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Get current queue sorted by status and download time
     * @returns {Array} Current queue
     */
    getQueue() {
        return [...this.queue].sort((a, b) => {
            // Sort by status priority: downloading > queued > completed > failed
            const statusPriority = {
                'downloading': 4,
                'queued': 3,
                'completed': 2,
                'failed': 1
            };
            
            const aPriority = statusPriority[a.status] || 0;
            const bPriority = statusPriority[b.status] || 0;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority;
            }
            
            // Within same status, sort by most recent first
            const aTime = a.downloadedAt || a.updatedAt || a.addedAt || '';
            const bTime = b.downloadedAt || b.updatedAt || b.addedAt || '';
            
            return bTime.localeCompare(aTime);
        });
    }

    /**
     * Set queue update callback
     * @param {Function} callback - Callback function
     */
    setQueueUpdateCallback(callback) {
        this.onQueueUpdate = callback;
    }

    /**
     * Notify queue update
     */
    notifyQueueUpdate() {
        if (this.onQueueUpdate) {
            this.onQueueUpdate(this.getQueue(), this.getStats());
        }
    }

    /**
     * Check if queue is empty
     * @returns {boolean} True if queue is empty
     */
    isEmpty() {
        return this.queue.length === 0;
    }

    /**
     * Check if currently processing
     * @returns {boolean} True if processing
     */
    isActive() {
        return this.isProcessing;
    }
} 