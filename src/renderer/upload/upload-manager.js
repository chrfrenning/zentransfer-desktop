/**
 * Upload Manager
 * Handles file uploads, queue management, and progress tracking
 * Now uses main process worker pool for actual upload processing
 */

import { UIComponents } from '../components/ui-components.js';
import { StorageManager } from '../components/storage-manager.js';
import { logger } from '../RendererLogger.js';

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
        
        logger.info('UploadManager: Initialized with main process worker pool support');
        
        // Listen for progress updates from main process
        this.setupProgressListener();
    }

    /**
     * Setup progress listener for main process updates
     */
    setupProgressListener() {
        if (window.electronAPI) {
            try {
                this.progressCleanup = window.electronAPI.upload.onProgress((progressData) => {
                    this.handleProgressUpdate(progressData);
                });
            } catch (error) {
                window.logger.info('IPC not available for progress updates');
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
            // Retry logic to handle race condition where token might not be immediately available after login
            let tokenResult = null;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                window.logger.info(`Attempting to get valid token (attempt ${retryCount + 1}/${maxRetries})...`);
                tokenResult = await TokenManager.ensureValidToken();
                
                if (tokenResult.valid) {
                    window.logger.info('Valid token obtained successfully');
                    break;
                }
                
                retryCount++;
                if (retryCount < maxRetries) {
                    window.logger.info(`Token not available yet, waiting 500ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            if (!tokenResult || !tokenResult.valid) {
                throw new Error('Authentication required - please log in again');
            }

            if (window.electronAPI) {
                window.logger.info('Creating upload session via main process...');
                const result = await window.electronAPI.upload.createSession({
                    serverBaseUrl: config.SERVER_BASE_URL,
                    token: tokenResult.token,
                    appName: config.APP_NAME,
                    appVersion: config.APP_VERSION,
                    clientId: config.CLIENT_ID
                });
                
                if (result.success) {
                    this.uploadSession = result.session;
                    this.isSessionInitialized = true;
                    window.logger.info('Upload session created via main process successfully');
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
            console.error('Failed to initialize upload session. Please try again.');
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
            window.logger.info('Upload session created directly');
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
        window.logger.info('UploadManager: Auth state changed to:', authState.status);
        
        if (authState.status === 'authenticated' && !this.isSessionInitialized) {
            // User just logged in, give token management a moment to complete then initialize upload session
            window.logger.info('UploadManager: User authenticated, waiting briefly then initializing upload session...');
            
            // Small delay to ensure token is fully saved in main process
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const success = await this.initializeSession();
            if (success) {
                window.logger.info('UploadManager: Upload session initialized successfully');
            } else {
                window.logger.info('UploadManager: Failed to initialize upload session');
            }
        } else if (authState.status === 'unauthenticated') {
            // User logged out, clear session
            window.logger.info('UploadManager: User logged out, clearing upload session...');
            this.clearSession();
        } else if (authState.status === 'checking') {
            window.logger.info('UploadManager: Authentication check in progress, waiting...');
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
        window.logger.info('=== UPLOAD MANAGER: addFiles called ===');
        window.logger.info('Input type:', files.constructor.name);
        window.logger.info('Number of files:', files.length);
        
        // Check if user is authenticated only for ZenTransfer uploads
        if (this.selectedService === 'zentransfer') {
            const tokenResult = await TokenManager.ensureValidToken();
            if (!tokenResult.valid) {
                console.warn('Please log in to upload files to ZenTransfer.');
                return;
            }
        }

        // Get current skip duplicates setting from preferences
        const skipDuplicates = await window.electronAPI.config.get('preferences.skipDuplicates') || false;
        window.logger.info('Upload Manager: addFiles - skipDuplicates from preferences:', skipDuplicates);
        
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

        window.logger.info('=== PROCESSING FILES ===');
        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];
            window.logger.info(`Processing file ${i + 1}/${fileArray.length}:`, {
                name: typeof file === 'string' ? file : file.name,
                type: typeof file,
                isString: typeof file === 'string',
                isFileObject: file instanceof File,
                hasPath: !!(file.path),
                size: typeof file === 'string' ? 'unknown' : file.size
            });
            
            let fileItem;
            
            if (typeof file === 'string') {
                // Handle file path (from import system)
                window.logger.info('  -> Creating file item from path (no temporary file needed)');
                fileItem = await this.createFileItemFromPath(file);
            } else {
                // Handle File object (from file input/drag-drop)
                window.logger.info('  -> Creating file item from File object (may need temporary file)');
                fileItem = this.createFileItemFromFile(file);
            }
            
            if (!fileItem) {
                console.warn(`  -> Failed to create file item for file ${i + 1}`);
                continue;
            }

            window.logger.info(`  -> File item created:`, {
                id: fileItem.id,
                name: fileItem.name,
                size: fileItem.size,
                type: fileItem.type,
                hasFilePath: !!(fileItem.filePath),
                hasFileObject: !!(fileItem.file),
                source: fileItem.source
            });

            // Validate file size
            if (fileItem.size > config.MAX_FILE_SIZE) {
                console.error(`File "${fileItem.name}" is too large. Maximum size is ${this.formatFileSize(config.MAX_FILE_SIZE)}.`);
                continue;
            }

            // Add import settings to file item so upload worker can access skipDuplicates
            fileItem.importSettings = importSettings;

            validFiles.push(fileItem);
        }

        window.logger.info(`=== ADDING ${validFiles.length} VALID FILES TO QUEUE ===`);
        if (validFiles.length > 0) {
            this.queue.push(...validFiles);
            window.logger.info('Queue updated. Total files in queue:', this.queue.length);
            this.notifyQueueUpdate();

            // Start processing if not already running
            if (!this.isProcessing) {
                window.logger.info('Starting upload processing...');
                this.startProcessing();
            } else {
                window.logger.info('Processing already running, files added to queue');
            }
        } else {
            window.logger.info('No valid files to add to queue');
        }
    }

    /**
     * Create file item from File object
     * @param {File} file - File object
     * @returns {Object} File item
     */
    createFileItemFromFile(file) {
        window.logger.info('=== CREATING FILE ITEM FROM FILE OBJECT ===');
        window.logger.info('File object details:', {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            lastModifiedDate: new Date(file.lastModified),
            webkitRelativePath: file.webkitRelativePath || '(none)',
            constructor: file.constructor.name,
            // Check for path property (may be available in some Electron contexts)
            path: file.path || '(no path property)',
            // Check for additional properties
            keys: Object.keys(file)
        });
        
        // Check if File object has a path property (Electron drag/drop files)
        const hasPath = file.path && typeof file.path === 'string';
        window.logger.info('File path analysis:', {
            hasPath: hasPath,
            pathValue: file.path || '(none)',
            canUseDirectPath: hasPath
        });
        
        let fileItem;
        
        if (hasPath) {
            // File has a real path - use it directly like import files (no temporary file needed!)
            window.logger.info('✓ File has path property - using direct path strategy (EFFICIENT)');
            fileItem = {
                id: this.generateFileId(),
                filePath: file.path,  // Use the real file path
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
                source: 'drag-drop-with-path'
            };
        } else {
            // File object without path - fallback to buffer strategy (needs temporary file)
            window.logger.info('⚠️ File has no path property - using buffer strategy (REQUIRES TEMPORARY FILE)');
            fileItem = {
                id: this.generateFileId(),
                file: file,  // Store the File object for buffer extraction
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
                source: 'drag-drop-buffer'
            };
        }
        
        window.logger.info('File item created:', {
            id: fileItem.id,
            name: fileItem.name,
            size: fileItem.size,
            type: fileItem.type,
            hasFileObject: !!(fileItem.file),
            hasFilePath: !!(fileItem.filePath),
            source: fileItem.source,
            willNeedTemporaryFile: !fileItem.filePath && !!fileItem.file,
            optimizationUsed: hasPath ? 'Direct path (like import)' : 'Buffer + temp file'
        });
        
        return fileItem;
    }

    /**
     * Create file item from file path (Electron only)
     * @param {string} filePath - File path
     * @returns {Object|null} File item or null if failed
     */
    async createFileItemFromPath(filePath) {
                    if (!window.electronAPI) {
            console.error('File path upload only supported in Electron environment');
            return null;
        }

        try {
            // Get file stats
            const stats = window.electronAPI.node.statSync(filePath);
            if (!stats.isFile) {
                console.error('Path is not a file:', filePath);
                return null;
            }

            const fileName = window.electronAPI.node.basename(filePath);
            const fileSize = stats.size;
            
            // Determine MIME type from extension
            const ext = window.electronAPI.node.extname(fileName).toLowerCase();
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
        
        window.logger.info(`Adding files from import for ${serviceName}:`, filePaths.length, 'files');
        
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
            window.logger.info('No files to add from import');
            return;
        }

        // Check if user is authenticated (only for ZenTransfer)
        if (serviceType === 'zentransfer') {
            const tokenResult = await TokenManager.ensureValidToken();
            if (!tokenResult.valid) {
                console.warn('User not authenticated, skipping ZenTransfer upload');
                console.warn('Please log in to upload imported files to ZenTransfer.');
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
        window.logger.info(`${validFiles.length} imported file${validFiles.length > 1 ? 's' : ''} queued for upload to ${serviceName}`);
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
        window.logger.info('Starting upload processing with concurrency');

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
                            console.error('Upload session failed. Please try again.');
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
            window.logger.info('Upload processing completed');
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
        window.logger.info('=== UPLOAD MANAGER: uploadFileViaMainProcess ===');
        window.logger.info('File item details:', {
            id: fileItem.id,
            name: fileItem.name,
            size: fileItem.size,
            type: fileItem.type,
            hasFilePath: !!(fileItem.filePath),
            hasFileObject: !!(fileItem.file),
            source: fileItem.source,
            serviceType: fileItem.serviceType || this.selectedService
        });
        
        if (window.electronAPI) {
            try {
                let fileBuffer = null;
                let useFilePath = false;
                
                window.logger.info('=== DETERMINING FILE HANDLING STRATEGY ===');
                
                if (fileItem.filePath) {
                    // File path upload (from import system or drag/drop with path)
                    // Pass file path directly to worker - no need to read into memory
                    useFilePath = true;
                    window.logger.info('✓ Using file path strategy (EFFICIENT - NO TEMPORARY FILES)');
                    window.logger.info('  - File path:', fileItem.filePath);
                    window.logger.info('  - Source:', fileItem.source);
                    window.logger.info('  - Benefits: No memory usage, no temporary files, direct file access');
                    
                    if (fileItem.source === 'drag-drop-with-path') {
                        window.logger.info('  - 🎉 OPTIMIZATION: Drag/drop file using direct path (like import files)!');
                    }
                } else if (fileItem.file) {
                    // File object upload (from web-based drag-drop without path)
                    // Only read into buffer for web files that don't have a local path
                    window.logger.info('⚠️ Using file buffer strategy (DRAG/DROP - REQUIRES TEMPORARY FILE)');
                    window.logger.info('  - File object:', fileItem.file);
                    window.logger.info('  - Source:', fileItem.source);
                    window.logger.info('  - Reason: File object has no path property');
                    window.logger.info('  - Will read file into memory buffer...');
                    
                    const bufferStart = Date.now();
                    fileBuffer = await this.fileToBuffer(fileItem.file);
                    const bufferTime = Date.now() - bufferStart;
                    
                    window.logger.info('  - Buffer created:', {
                        size: fileBuffer.length,
                        timeToCreate: bufferTime + 'ms',
                        memoryUsage: (fileBuffer.length / 1024 / 1024).toFixed(2) + 'MB'
                    });
                    window.logger.info('  - This buffer will be written to temporary file by worker');
                } else {
                    throw new Error('No file or file path available for upload');
                }
                
                window.logger.info('File handling strategy determined:', {
                    useFilePath: useFilePath,
                    willNeedTemporaryFile: !useFilePath,
                    bufferSize: fileBuffer ? fileBuffer.length : 0,
                    source: fileItem.source,
                    optimizationApplied: fileItem.source === 'drag-drop-with-path' ? 'YES - Direct path from drag/drop' : 'NO'
                });
                
                // Only check authentication for ZenTransfer uploads
                let tokenResult = { valid: false, token: null };
                if ((fileItem.serviceType || this.selectedService) === 'zentransfer') {
                    tokenResult = await TokenManager.ensureValidToken();
                    if (!tokenResult.valid) {
                        throw new Error('Authentication required for ZenTransfer uploads');
                    }
                }
                
                // Get service preferences from config system
                const servicePreferences = await this.getServicePreferences();
                
                window.logger.info('Calling upload worker with:', {
                    fileId: fileItem.id,
                    fileName: fileItem.name,
                    hasFileBuffer: !!(fileBuffer),
                    hasFilePath: !!(fileItem.filePath),
                    serviceType: fileItem.serviceType || this.selectedService
                });
                
                const result = await window.electronAPI.upload.uploadFile({
                    fileId: fileItem.id,
                    fileName: fileItem.name,
                    fileSize: fileItem.size,
                    fileType: fileItem.type,
                    fileBuffer: useFilePath ? null : fileBuffer, // Only pass buffer for web files
                    filePath: useFilePath ? fileItem.filePath : null, // Pass file path for local files
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
                
                window.logger.info('Upload worker result:', result);
                
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
                const buffer = window.electronAPI.node.bufferFromArrayBuffer(arrayBuffer);
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
            window.logger.info('File removed from queue.');
        }
    }

    /**
     * Clear completed files from log
     */
    clearCompleted() {
        const completedCount = this.uploadLog.filter(item => item.status === 'completed').length;
        this.uploadLog = this.uploadLog.filter(item => item.status !== 'completed');
        
        if (completedCount > 0) {
            window.logger.info(`Cleared ${completedCount} completed upload${completedCount > 1 ? 's' : ''}.`);
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
        window.logger.info('All uploads cleared.');
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
        
        window.logger.info('Upload history cleared');
    }

    /**
     * Stop all uploads and clear queue
     */
    async stopAllUploads() {
        window.logger.info('Stopping all uploads...');
        
        try {
            // Cancel all active uploads via main process
            if (window.electronAPI) {
                await window.electronAPI.upload.cancelAll();
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
            window.logger.info('All uploads stopped.');
            
        } catch (error) {
            console.error('Failed to stop uploads:', error);
            console.error('Failed to stop uploads: ' + error.message);
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
     * Get service preferences from config system
     * @returns {Promise<Object>} Service preferences
     */
    async getServicePreferences() {
        try {
            // Get cloud service configurations from config
            const awsS3Service = await window.electronAPI.config.getCloudSettings('aws-s3');
            const azureService = await window.electronAPI.config.getCloudSettings('azure-blob');
            const gcpService = await window.electronAPI.config.getCloudSettings('gcp-storage');
            const minioService = await window.electronAPI.config.getCloudSettings('minio');
            
            // Get thumbnail/preview preferences
            const createPreviews = await window.electronAPI.config.get('preferences.createPreviews');
            const extractMetadata = await window.electronAPI.config.get('preferences.extractMetaData');
            const thumbnailSize = await window.electronAPI.config.get('preferences.thumbnailSize');
            const thumbnailQuality = await window.electronAPI.config.get('preferences.thumbnailQuality');
            const previewSize = await window.electronAPI.config.get('preferences.previewSize');
            const previewQuality = await window.electronAPI.config.get('preferences.previewQuality');
            
            // Convert to the format expected by uploadServiceFactory
            const preferences = {
                // Thumbnail/preview preferences
                createPreviews: createPreviews || false,
                extractMetadata: extractMetadata || false,
                thumbnailSize: thumbnailSize || 400,
                thumbnailQuality: thumbnailQuality || 90,
                previewSize: previewSize || 1920,
                previewQuality: previewQuality || 90
            };
            
            // AWS S3
            if (awsS3Service && awsS3Service.enabled) {
                preferences.awsS3Enabled = awsS3Service.enabled;
                preferences.awsS3Region = awsS3Service.region;
                preferences.awsS3Bucket = awsS3Service.bucket;
                preferences.awsS3AccessKey = awsS3Service.accessKey;
                preferences.awsS3SecretKey = awsS3Service.secretKey;
                preferences.awsS3StorageTier = awsS3Service.storageClass;
            }
            
            // Azure Blob Storage
            if (azureService && azureService.enabled) {
                preferences.azureEnabled = azureService.enabled;
                preferences.azureConnectionString = azureService.connectionString;
                preferences.azureContainer = azureService.containerName;
            }
            
            // GCP Storage
            if (gcpService && gcpService.enabled) {
                preferences.gcpEnabled = gcpService.enabled;
                preferences.gcpBucket = gcpService.bucketName;
                preferences.gcpServiceAccountKey = gcpService.serviceAccountKey;
            }
            
            // MinIO
            if (minioService && minioService.enabled) {
                preferences.minioEnabled = minioService.enabled;
                preferences.minioEndpoint = minioService.endpoint;
                preferences.minioBucket = minioService.bucket;
                preferences.minioAccessKey = minioService.accessKey;
                preferences.minioSecretKey = minioService.secretKey;
                preferences.minioRegion = minioService.region;
                preferences.minioUseSSL = minioService.useSSL;
                preferences.minioPort = minioService.port;
            }
            
            return preferences;
        } catch (error) {
            console.error('Failed to load service preferences from config:', error);
            return {};
        }
    }

    /**
     * Set the selected upload service
     * @param {string} serviceType - Type of service to use for uploads
     */
    setSelectedService(serviceType) {
        this.selectedService = serviceType;
        window.logger.info('Upload service changed to:', serviceType);
    }

    /**
     * Get the currently selected service
     * @returns {string|null} Selected service type
     */
    getSelectedService() {
        return this.selectedService || 'zentransfer';
    }
} 