/**
 * Upload Queue Manager
 * Manages upload queue communication with main process SQLite queue
 * Handles IPC communication and provides interface for renderer components
 */

export class UploadQueueManager {
    constructor() {
        this.isInitialized = false;
        
        // Callback functions for events
        this.callbacks = {
            onQueueUpdate: null,
            onUploadProgress: null,
            onUploadStarted: null,
            onUploadCompleted: null,
            onUploadFailed: null,
            onError: null
        };
        
        // Current queue state (for display)
        this.currentFiles = [];
        this.currentStats = {};
        this.backoffState = {};
        
        this.initializeIPC();
    }
    
    /**
     * Initialize IPC communication with main process
     */
    initializeIPC() {
        try {
            if (window.electronAPI) {
                // Listen for upload updates from main process
                this.updateCleanup = window.electronAPI.upload.onUpdate((data) => {
                    this.handleUploadUpdate(data);
                });
                
                this.isInitialized = true;
                console.log('Upload queue manager IPC initialized');
            } else {
                throw new Error('IPC not available - not in Electron environment');
            }
        } catch (error) {
            console.error('Failed to initialize upload queue IPC:', error);
            throw error;
        }
    }
    
    /**
     * Handle upload updates from main process
     */
    handleUploadUpdate(data) {
        const { type } = data;
        
        console.log('Upload queue update received:', type);
        
        switch (type) {
            case 'queue-update':
                this.currentFiles = data.files || [];
                this.currentStats = data.stats || {};
                this.backoffState = data.backoffState || {};
                
                if (this.callbacks.onQueueUpdate) {
                    this.callbacks.onQueueUpdate(this.currentFiles, this.currentStats, this.backoffState);
                }
                break;
                
            case 'upload-started':
                if (this.callbacks.onUploadStarted) {
                    this.callbacks.onUploadStarted(data);
                }
                break;
                
            case 'upload-progress':
                if (this.callbacks.onUploadProgress) {
                    this.callbacks.onUploadProgress(data);
                }
                break;
                
            case 'upload-completed':
                if (this.callbacks.onUploadCompleted) {
                    this.callbacks.onUploadCompleted(data);
                }
                break;
                
            case 'upload-failed':
                if (this.callbacks.onUploadFailed) {
                    this.callbacks.onUploadFailed(data);
                }
                break;
                
            case 'error':
                console.error('Upload queue error:', data.error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(data);
                }
                break;
                
            default:
                console.warn('Unknown upload update type:', type);
        }
    }
    
    /**
     * Add files to the upload queue
     * @param {Array} files - Array of file objects to queue
     */
    async addFiles(files) {
        if (!this.isInitialized) {
            throw new Error('Upload queue manager not initialized');
        }
        
        try {
            // Convert files to queue format
            const queueFiles = await this.prepareFileItems(files);
            
            const result = await window.electronAPI.upload.addToQueue(queueFiles);
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return result.results;
        } catch (error) {
            console.error('Failed to add files to upload queue:', error);
            throw error;
        }
    }
    
    /**
     * Prepare file items for the queue
     * @param {Array} files - Raw file data (File objects or file paths)
     */
    async prepareFileItems(files) {
        const preparedFiles = [];
        
        for (const file of files) {
            let fileItem;
            
            if (typeof file === 'string') {
                // File path (from import system)
                fileItem = await this.createFileItemFromPath(file);
            } else if (file.filePath) {
                // Already prepared file item
                fileItem = file;
            } else {
                // File object (from drag/drop)
                fileItem = await this.createFileItemFromFile(file);
            }
            
            if (fileItem) {
                preparedFiles.push(fileItem);
            }
        }
        
        return preparedFiles;
    }
    
    /**
     * Create file item from File object
     */
    async createFileItemFromFile(file) {
        try {
            // Determine MIME type
            let mimeType = file.type || 'application/octet-stream';
            
            // For files with paths (Electron drag/drop), use path directly
            if (file.path) {
                return {
                    filePath: file.path,
                    filename: file.name,
                    fileSize: file.size,
                    mimeType: mimeType,
                    serviceType: 'zentransfer', // Default service
                    dateAdded: new Date().toISOString(),
                    importSettings: null
                };
            }
            
            // For web File objects without paths, we need to handle them differently
            // This would require creating temporary files in the main process
            console.warn('File objects without paths not yet supported in queue');
            return null;
            
        } catch (error) {
            console.error('Failed to create file item from File object:', error);
            return null;
        }
    }
    
    /**
     * Create file item from file path (Electron environment)
     */
    async createFileItemFromPath(filePath) {
        if (!window.electronAPI) {
            console.error('File path uploads only supported in Electron environment');
            return null;
        }
        
        try {
            // Get file stats
            const stats = window.electronAPI.node.statSync(filePath);
            if (!stats.isFile) {
                console.error('Path is not a file:', filePath);
                return null;
            }
            
            const filename = window.electronAPI.node.basename(filePath);
            const fileSize = stats.size;
            
            // Determine MIME type from extension
            const ext = window.electronAPI.node.extname(filename).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
                '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
                '.mkv': 'video/x-matroska', '.webm': 'video/webm',
                '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
                '.pdf': 'application/pdf', '.txt': 'text/plain', '.zip': 'application/zip'
            };
            
            const mimeType = mimeTypes[ext] || 'application/octet-stream';
            
            return {
                filePath: filePath,
                filename: filename,
                fileSize: fileSize,
                mimeType: mimeType,
                serviceType: 'zentransfer', // Default service
                dateAdded: new Date().toISOString(),
                importSettings: null
            };
            
        } catch (error) {
            console.error('Failed to create file item from path:', filePath, error);
            return null;
        }
    }
    
    /**
     * Get current queue statistics
     */
    async getQueueStats() {
        if (!this.isInitialized) {
            throw new Error('Upload queue manager not initialized');
        }
        
        try {
            const result = await window.electronAPI.upload.getQueueStats();
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return result.stats;
        } catch (error) {
            console.error('Failed to get queue stats:', error);
            throw error;
        }
    }
    

    
    /**
     * Cancel all active uploads
     */
    async cancelAllUploads() {
        if (!this.isInitialized) {
            throw new Error('Upload queue manager not initialized');
        }
        
        try {
            const result = await window.electronAPI.upload.cancelAll();
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return result;
        } catch (error) {
            console.error('Failed to cancel uploads:', error);
            throw error;
        }
    }
    
    /**
     * Set callback functions for upload events
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }
    
    /**
     * Get current files in queue (cached)
     */
    getCurrentFiles() {
        return [...this.currentFiles];
    }
    
    /**
     * Get current queue stats (cached)
     */
    getCurrentStats() {
        return { ...this.currentStats };
    }
    
    /**
     * Get current backoff state (cached)
     */
    getBackoffState() {
        return { ...this.backoffState };
    }
    
    /**
     * Check if queue is currently in backoff period
     */
    isInBackoff() {
        return this.backoffState.isInBackoff || false;
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.updateCleanup) {
            this.updateCleanup();
            this.updateCleanup = null;
        }
        
        this.isInitialized = false;
        this.callbacks = {};
        this.currentFiles = [];
        this.currentStats = {};
        this.backoffState = {};
    }
} 