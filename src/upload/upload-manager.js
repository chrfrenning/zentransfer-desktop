/**
 * Upload Manager
 * Handles file uploads, queue management, and progress tracking
 * Now uses main process worker pool for actual upload processing
 */

import { config } from '../config/app-config.js';
import { TokenManager } from '../auth/token-manager.js';
import { UIComponents } from '../components/ui-components.js';
import { StorageManager } from '../components/storage-manager.js';

export class UploadManager {
    constructor() {
        this.queue = [];
        this.uploadLog = [];
        this.isProcessing = false;
        this.activeUploads = new Map(); // Track concurrent uploads
        this.uploadSession = null;
        this.onProgressUpdate = null;
        this.onQueueUpdate = null;
        this.isSessionInitialized = false;
        this.maxConcurrentUploads = 3;
        this.selectedService = 'zentransfer'; // Default service
        
        console.log('UploadManager: Initialized with main process worker pool support');
        
        // Listen for progress updates from main process
        this.setupProgressListener();
    }

    /**
     * Setup progress listener for main process updates
     */
    setupProgressListener() {
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                
                ipcRenderer.on('upload-progress', (event, progressData) => {
                    this.handleProgressUpdate(progressData);
                });
            } catch (error) {
                console.log('IPC not available for progress updates');
            }
        }
    }

    /**
     * Handle progress update from main process
     */
    handleProgressUpdate(progressData) {
        const { fileId, progress, status } = progressData;
        
        // Find the file in queue or active uploads
        let fileItem = this.queue.find(item => item.id === fileId);
        if (!fileItem) {
            fileItem = Array.from(this.activeUploads.values()).find(item => item.id === fileId);
        }
        
        if (fileItem) {
            fileItem.progress = progress;
            fileItem.status = progress === 100 ? 'completed' : 'uploading';
            if (status) {
                fileItem.statusMessage = status;
            }
            
            this.notifyProgressUpdate(fileItem);
            
            // If completed, move to log
            if (progress === 100) {
                this.activeUploads.delete(fileId);
                this.moveToLog(fileItem);
                this.processNextInQueue();
            }
        }
    }

    /**
     * Initialize session if needed
     */
    async initializeSession() {
        try {
            const tokenResult = await TokenManager.ensureValidToken();
            if (!tokenResult.valid) {
                throw new Error('Authentication required');
            }

            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                
                const result = await ipcRenderer.invoke('create-upload-session', {
                    serverBaseUrl: config.SERVER_BASE_URL,
                    token: tokenResult.token,
                    appName: config.APP_NAME,
                    appVersion: config.APP_VERSION,
                    clientId: config.CLIENT_ID
                });
                
                if (result.success) {
                    this.uploadSession = result.session;
                    this.isSessionInitialized = true;
                    console.log('Upload session created via main process');
                    return true;
                } else {
                    throw new Error(result.error);
                }
            } else {
                // Fallback for web environment
                return await this.createUploadSessionDirect();
            }
        } catch (error) {
            console.error('Failed to initialize upload session:', error);
            UIComponents.Notification.show('Failed to initialize upload session. Please try again.', 'error');
            return false;
        }
    }

    /**
     * Direct session creation fallback
     */
    async createUploadSessionDirect() {
        try {
            const tokenResult = await TokenManager.ensureValidToken();
            if (!tokenResult.valid) {
                throw new Error('Authentication required');
            }

            const response = await fetch(`${config.SERVER_BASE_URL}/api/upload/startsession`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenResult.token}`
                },
                body: JSON.stringify({
                    app_name: config.APP_NAME,
                    app_version: config.APP_VERSION,
                    client_id: config.CLIENT_ID
                })
            });

            if (response.status !== 200) {
                throw new Error(`Failed to create upload session: ${response.status}`);
            }

            const data = await response.json();
            
            this.uploadSession = {
                parentId: data.parent_id,
                uploadUrl: data.upload_url,
                expiresAt: new Date(data.expires_at).getTime()
            };
            
            this.isSessionInitialized = true;
            console.log('Upload session created directly');
            return true;
        } catch (error) {
            console.error('Direct upload session creation failed:', error);
            throw error;
        }
    }

    /**
     * Set callback for progress updates
     * @param {Function} callback - Called when upload progress changes
     */
    setProgressCallback(callback) {
        this.onProgressUpdate = callback;
    }

    /**
     * Set callback for queue updates
     * @param {Function} callback - Called when queue changes
     */
    setQueueCallback(callback) {
        this.onQueueUpdate = callback;
    }

    /**
     * Handle authentication state change
     * @param {Object} authState - Authentication state
     */
    async handleAuthStateChange(authState) {
        console.log('UploadManager: Auth state changed to:', authState.status);
        
        if (authState.status === 'authenticated' && !this.isSessionInitialized) {
            // User just logged in, initialize upload session
            console.log('UploadManager: User authenticated, initializing upload session...');
            const success = await this.initializeSession();
            if (success) {
                console.log('UploadManager: Upload session initialized successfully');
            } else {
                console.log('UploadManager: Failed to initialize upload session');
            }
        } else if (authState.status === 'unauthenticated') {
            // User logged out, clear session
            console.log('UploadManager: User logged out, clearing upload session...');
            this.clearSession();
        } else if (authState.status === 'checking') {
            console.log('UploadManager: Authentication check in progress, waiting...');
        }
    }

    /**
     * Clear upload session and reset state
     */
    clearSession() {
        this.uploadSession = null;
        this.isSessionInitialized = false;
        this.queue = [];
        this.uploadLog = [];
        this.isProcessing = false;
        this.activeUploads.clear();
        this.notifyQueueUpdate();
    }

    /**
     * Add files to upload queue
     * @param {FileList|Array} files - Files to add (File objects or file paths)
     */
    async addFiles(files) {
        // Check if user is authenticated only for ZenTransfer uploads
        if (this.selectedService === 'zentransfer') {
            const tokenResult = await TokenManager.ensureValidToken();
            if (!tokenResult.valid) {
                UIComponents.Notification.show('Please log in to upload files to ZenTransfer.', 'warning');
                return;
            }
        }

        // Get current skip duplicates setting from settings screen
        const skipDuplicates = StorageManager.getImportSkipDuplicates();
        console.log('Upload Manager: addFiles - skipDuplicates from settings:', skipDuplicates);
        
        // Create import settings for upload worker (similar to import screen)
        const importSettings = {
            skipDuplicates: skipDuplicates,
            // These are not used for regular uploads but included for consistency
            organizeIntoFolders: false,
            folderOrganizationType: 'date',
            customFolderName: '',
            dateFormat: '2025/05/26'
        };

        const fileArray = Array.from(files);
        const validFiles = [];

        for (const file of fileArray) {
            let fileItem;
            
            if (typeof file === 'string') {
                // Handle file path (from import system)
                fileItem = await this.createFileItemFromPath(file);
            } else {
                // Handle File object (from file input/drag-drop)
                fileItem = this.createFileItemFromFile(file);
            }
            
            if (!fileItem) continue;

            // Validate file size
            if (fileItem.size > config.MAX_FILE_SIZE) {
                UIComponents.Notification.show(
                    `File "${fileItem.name}" is too large. Maximum size is ${this.formatFileSize(config.MAX_FILE_SIZE)}.`,
                    'error'
                );
                continue;
            }

            // Add import settings to file item so upload worker can access skipDuplicates
            fileItem.importSettings = importSettings;

            validFiles.push(fileItem);
        }

        if (validFiles.length > 0) {
            this.queue.push(...validFiles);
            this.notifyQueueUpdate();

            // Start processing if not already running
            if (!this.isProcessing) {
                this.startProcessing();
            }
        }
    }

    /**
     * Create file item from File object
     * @param {File} file - File object
     * @returns {Object} File item
     */
    createFileItemFromFile(file) {
        return {
            id: this.generateFileId(),
            file: file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending',
            progress: 0,
            error: null,
            uploadId: null,
            finalUrl: null,
            addedAt: Date.now(),
            statusMessage: 'Queued',
            source: 'file-input'
        };
    }

    /**
     * Create file item from file path (Electron only)
     * @param {string} filePath - File path
     * @returns {Object|null} File item or null if failed
     */
    async createFileItemFromPath(filePath) {
        if (typeof require === 'undefined') {
            console.error('File path upload only supported in Electron environment');
            return null;
        }

        try {
            const fs = require('fs');
            const path = require('path');
            
            // Get file stats
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
                console.error('Path is not a file:', filePath);
                return null;
            }

            const fileName = path.basename(filePath);
            const fileSize = stats.size;
            
            // Determine MIME type from extension
            const ext = path.extname(fileName).toLowerCase();
            let mimeType = 'application/octet-stream';
            
            // Basic MIME type detection
            const mimeTypes = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
                '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
                '.mkv': 'video/x-matroska', '.webm': 'video/webm',
                '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
                '.pdf': 'application/pdf', '.txt': 'text/plain', '.zip': 'application/zip'
            };
            
            if (mimeTypes[ext]) {
                mimeType = mimeTypes[ext];
            }

            return {
                id: this.generateFileId(),
                file: null, // No File object for path-based uploads
                filePath: filePath,
                name: fileName,
                size: fileSize,
                type: mimeType,
                status: 'pending',
                progress: 0,
                error: null,
                uploadId: null,
                finalUrl: null,
                addedAt: Date.now(),
                statusMessage: 'Queued',
                source: 'import'
            };
        } catch (error) {
            console.error('Failed to create file item from path:', filePath, error);
            return null;
        }
    }

    /**
     * Add files from import system
     * @param {Array<string>} filePaths - Array of file paths to upload
     * @param {Object} options - Upload options
     */
    async addFilesFromImport(filePaths, options = {}) {
        const serviceType = options.serviceType || 'zentransfer';
        const serviceName = options.serviceName || 'ZenTransfer';
        const importSettings = options.importSettings || {};
        
        console.log(`Adding files from import for ${serviceName}:`, filePaths.length, 'files');
        
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
            console.log('No files to add from import');
            return;
        }

        // Check if user is authenticated (only for ZenTransfer)
        if (serviceType === 'zentransfer') {
            const tokenResult = await TokenManager.ensureValidToken();
            if (!tokenResult.valid) {
                console.warn('User not authenticated, skipping ZenTransfer upload');
                UIComponents.Notification.show('Please log in to upload imported files to ZenTransfer.', 'warning');
                return;
            }
        }

        // Create file items with service information
        const validFiles = [];
        for (const filePath of filePaths) {
            const fileItem = await this.createFileItemFromPath(filePath);
            if (fileItem) {
                // Add service information to the file item
                fileItem.serviceType = serviceType;
                fileItem.serviceName = serviceName;
                fileItem.statusMessage = `Queued for ${serviceName}`;
                fileItem.importSettings = importSettings; // Store import settings for folder organization
                validFiles.push(fileItem);
            }
        }

        if (validFiles.length > 0) {
            this.queue.push(...validFiles);
            this.notifyQueueUpdate();

            // Start processing if not already running
            if (!this.isProcessing) {
                this.startProcessing();
            }
        }
        
        // Log without showing notification to avoid spam during import
        console.log(`${validFiles.length} imported file${validFiles.length > 1 ? 's' : ''} queued for upload to ${serviceName}`);
    }

    /**
     * Generate unique file ID
     */
    generateFileId() {
        return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Start processing upload queue with concurrency
     */
    async startProcessing() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        console.log('Starting upload processing with concurrency');

        try {
            // Check if we need to initialize session (only for ZenTransfer uploads)
            const hasZenTransferUploads = this.queue.some(item => 
                (item.serviceType || this.selectedService) === 'zentransfer'
            );
            
            if (hasZenTransferUploads && !this.isSessionInitialized) {
                const success = await this.initializeSession();
                if (!success) {
                    throw new Error('Failed to initialize upload session for ZenTransfer');
                }
            }

            // Start concurrent uploads
            this.processNextInQueue();

        } catch (error) {
            console.error('Queue processing failed:', error);
            UIComponents.Notification.show('Upload session failed. Please try again.', 'error');
            this.isProcessing = false;
        }
    }

    /**
     * Process next files in queue up to concurrency limit
     */
    processNextInQueue() {
        // Process files up to concurrency limit
        while (this.queue.length > 0 && this.activeUploads.size < this.maxConcurrentUploads) {
            const fileItem = this.queue.shift();
            this.startFileUpload(fileItem);
        }

        // Check if we're done processing
        if (this.queue.length === 0 && this.activeUploads.size === 0) {
            this.isProcessing = false;
            console.log('Upload processing completed');
        }

        this.notifyQueueUpdate();
    }

    /**
     * Start upload for a single file
     */
    async startFileUpload(fileItem) {
        this.activeUploads.set(fileItem.id, fileItem);
        fileItem.status = 'uploading';
        fileItem.progress = 0;
        
        try {
            await this.uploadFileViaMainProcess(fileItem);
        } catch (error) {
            console.error('Upload failed:', error);
            fileItem.status = 'failed';
            fileItem.error = error.message;
            fileItem.statusMessage = `Failed: ${error.message}`;
            
            this.activeUploads.delete(fileItem.id);
            this.moveToLog(fileItem);
            this.processNextInQueue();
        }
    }

    /**
     * Upload file via main process worker
     */
    async uploadFileViaMainProcess(fileItem) {
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                
                let fileBuffer;
                
                if (fileItem.filePath) {
                    
                    // File path upload (from import system)
                    const fs = require('fs');
                    fileBuffer = fs.readFileSync(fileItem.filePath);
                } else if (fileItem.file) {
                    // File object upload (from file input/drag-drop)
                    fileBuffer = await this.fileToBuffer(fileItem.file);
                } else {
                    throw new Error('No file or file path available for upload');
                }
                
                // Only check authentication for ZenTransfer uploads
                let tokenResult = { valid: false, token: null };
                if ((fileItem.serviceType || this.selectedService) === 'zentransfer') {
                    tokenResult = await TokenManager.ensureValidToken();
                    if (!tokenResult.valid) {
                        throw new Error('Authentication required for ZenTransfer uploads');
                    }
                }
                
                // Get service preferences from localStorage
                const servicePreferences = this.getServicePreferences();
                
                const result = await ipcRenderer.invoke('upload-file', {
                    fileId: fileItem.id,
                    fileName: fileItem.name,
                    fileSize: fileItem.size,
                    fileType: fileItem.type,
                    fileBuffer: fileBuffer,
                    filePath: fileItem.filePath,
                    source: fileItem.source,
                    serviceType: fileItem.serviceType || this.selectedService,
                    serviceName: fileItem.serviceName,
                    importSettings: fileItem.importSettings // Pass import settings for folder organization
                }, {
                    session: this.uploadSession,
                    token: tokenResult.token,
                    serverBaseUrl: config.SERVER_BASE_URL,
                    appName: config.APP_NAME,
                    appVersion: config.APP_VERSION,
                    clientId: config.CLIENT_ID,
                    servicePreferences: servicePreferences,
                    selectedService: fileItem.serviceType || this.selectedService
                });
                
                if (!result.success) {
                    throw new Error(result.error);
                }
                
                // Update file item with result
                fileItem.uploadId = result.result.uploadId;
                fileItem.finalUrl = result.result.finalUrl;
                
            } catch (error) {
                console.error('Main process upload failed:', error);
                throw error;
            }
        } else {
            // Fallback to direct upload for web environment
            await this.uploadFileDirect(fileItem);
        }
    }

    /**
     * Convert File to Buffer
     */
    async fileToBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const arrayBuffer = reader.result;
                const buffer = Buffer.from(arrayBuffer);
                resolve(buffer);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Direct file upload fallback
     */
    async uploadFileDirect(fileItem) {
        // Implementation of direct upload (existing logic)
        // This is a fallback for web environments
        throw new Error('Direct upload not implemented in this version');
    }

    /**
     * Move file from queue to log
     * @param {Object} fileItem - File item
     */
    moveToLog(fileItem) {
        fileItem.completedAt = Date.now();
        this.uploadLog.unshift(fileItem); // Add to beginning of log
        
        // Keep log size manageable
        if (this.uploadLog.length > 100) {
            this.uploadLog = this.uploadLog.slice(0, 100);
        }
    }

    /**
     * Remove file from queue
     * @param {string} fileId - File ID to remove
     */
    removeFile(fileId) {
        const index = this.queue.findIndex(item => item.id === fileId);
        if (index !== -1) {
            this.queue.splice(index, 1);
            this.notifyQueueUpdate();
            UIComponents.Notification.show('File removed from queue.', 'info');
        }
    }

    /**
     * Clear completed files from log
     */
    clearCompleted() {
        const completedCount = this.uploadLog.filter(item => item.status === 'completed').length;
        this.uploadLog = this.uploadLog.filter(item => item.status !== 'completed');
        
        if (completedCount > 0) {
            UIComponents.Notification.show(`Cleared ${completedCount} completed upload${completedCount > 1 ? 's' : ''}.`, 'info');
        }
    }

    /**
     * Clear all files from queue and log
     */
    clearAll() {
        this.queue = [];
        this.uploadLog = [];
        this.activeUploads.clear();
        this.notifyQueueUpdate();
        UIComponents.Notification.show('All uploads cleared.', 'info');
    }

    /**
     * Clear upload history and reset to initial state
     */
    clearHistory() {
        // Clear all queues and logs
        this.queue = [];
        this.uploadLog = [];
        this.activeUploads.clear();
        
        // Reset session
        this.uploadSession = null;
        this.isSessionInitialized = false;
        this.isProcessing = false;
        
        // Notify UI of changes
        this.notifyQueueUpdate();
        
        console.log('Upload history cleared');
    }

    /**
     * Stop all uploads and clear queue
     */
    async stopAllUploads() {
        console.log('Stopping all uploads...');
        
        try {
            // Cancel all active uploads via main process
            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                await ipcRenderer.invoke('cancel-all-uploads');
            }
            
            // Mark all active uploads as cancelled
            for (const fileItem of this.activeUploads.values()) {
                fileItem.status = 'cancelled';
                fileItem.statusMessage = 'Cancelled by user';
                this.moveToLog(fileItem);
            }
            
            // Clear active uploads and queue
            this.activeUploads.clear();
            this.queue = [];
            this.isProcessing = false;
            
            this.notifyQueueUpdate();
            UIComponents.Notification.show('All uploads stopped.', 'info');
            
        } catch (error) {
            console.error('Failed to stop uploads:', error);
            UIComponents.Notification.show('Failed to stop uploads: ' + error.message, 'error');
        }
    }

    /**
     * Get current upload info
     */
    getCurrentUpload() {
        // Return the first active upload
        return this.activeUploads.size > 0 ? Array.from(this.activeUploads.values())[0] : null;
    }

    /**
     * Get all active uploads
     * @returns {Array} Array of active upload file items
     */
    getActiveUploads() {
        return Array.from(this.activeUploads.values());
    }

    /**
     * Get queue statistics
     */
    getQueueStats() {
        const pending = this.queue.length;
        const uploading = this.activeUploads.size;
        const completed = this.uploadLog.filter(item => item.status === 'completed').length;
        const failed = this.uploadLog.filter(item => item.status === 'failed').length;

        return {
            pending,
            uploading,
            completed,
            failed,
            total: pending + uploading + completed + failed,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Get overall progress percentage
     */
    getOverallProgress() {
        const stats = this.getQueueStats();
        if (stats.total === 0) return 0;

        let totalProgress = stats.completed * 100;
        
        // Add progress from active uploads
        for (const fileItem of this.activeUploads.values()) {
            totalProgress += fileItem.progress;
        }
        
        const maxProgress = stats.total * 100;
        return Math.round(totalProgress / maxProgress * 100);
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Notify progress update
     * @param {Object} fileItem - File item with updated progress
     */
    notifyProgressUpdate(fileItem) {
        if (this.onProgressUpdate) {
            this.onProgressUpdate(fileItem);
        }
    }

    /**
     * Notify queue update
     */
    notifyQueueUpdate() {
        if (this.onQueueUpdate) {
            this.onQueueUpdate(this.getQueueStats());
        }
    }

    /**
     * Get service preferences from localStorage
     * @returns {Object} Service preferences
     */
    getServicePreferences() {
        try {
            const preferences = localStorage.getItem('zentransfer_preferences');
            return preferences ? JSON.parse(preferences) : {};
        } catch (error) {
            console.error('Failed to load service preferences:', error);
            return {};
        }
    }

    /**
     * Set the selected upload service
     * @param {string} serviceType - Type of service to use for uploads
     */
    setSelectedService(serviceType) {
        this.selectedService = serviceType;
        console.log('Upload service changed to:', serviceType);
    }

    /**
     * Get the currently selected service
     * @returns {string|null} Selected service type
     */
    getSelectedService() {
        return this.selectedService || 'zentransfer';
    }
} 