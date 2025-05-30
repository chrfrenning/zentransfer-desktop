/**
 * Import Worker
 * Background worker for handling file import operations
 */

// Import required modules for Node.js environment
let fs, path;
try {
    if (typeof require !== 'undefined') {
        fs = require('fs');
        path = require('path');
        console.log('Import worker: Node.js modules loaded successfully');
    } else {
        console.log('Import worker: Running in browser environment');
    }
} catch (error) {
    console.error('Import worker: Failed to load Node.js modules:', error);
    // Send error to main thread
    self.postMessage({ 
        type: 'error', 
        data: { error: 'Failed to initialize worker: ' + error.message } 
    });
}

// Global error handler for the worker
self.onerror = function(error) {
    console.error('Import worker global error:', error);
    self.postMessage({ 
        type: 'error', 
        data: { 
            error: `Global worker error: ${error.message}`,
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno
        } 
    });
};

// Global unhandled promise rejection handler
self.onunhandledrejection = function(event) {
    console.error('Import worker unhandled promise rejection:', event.reason);
    self.postMessage({ 
        type: 'error', 
        data: { 
            error: `Unhandled promise rejection: ${event.reason}`,
            stack: event.reason?.stack
        } 
    });
};

// Send initialization message
self.postMessage({ 
    type: 'worker-ready', 
    data: { message: 'Import worker initialized successfully' } 
});

/**
 * Current import job state
 */
let currentJob = null;
let isProcessing = false;
let shouldCancel = false;

/**
 * Message handler for worker communication
 */
self.onmessage = async function(e) {
    try {
        const { type, data } = e.data;
        console.log('Import worker received message:', type);

        switch (type) {
            case 'test':
                console.log('Import worker test message received:', data);
                sendMessage('test-response', { message: 'Worker is responding correctly', receivedData: data });
                break;
            case 'start-import':
                console.log('Import worker starting import with config:', data);
                await handleStartImport(data);
                break;
            case 'cancel-import':
                console.log('Import worker cancelling import');
                await handleCancelImport();
                break;
            case 'get-status':
                console.log('Import worker getting status');
                handleGetStatus();
                break;
            default:
                console.error('Unknown message type:', type);
                sendMessage('error', { error: `Unknown message type: ${type}` });
        }
    } catch (error) {
        console.error('Worker message handler error:', error);
        console.error('Error stack:', error.stack);
        sendMessage('error', { 
            error: error.message,
            stack: error.stack,
            details: error.toString()
        });
    }
};

/**
 * Handle start import request
 * @param {ImportJobConfig} jobConfig - Import job configuration
 */
async function handleStartImport(jobConfig) {
    console.log('handleStartImport called with:', jobConfig);
    
    if (isProcessing) {
        sendMessage('error', { error: 'Import already in progress' });
        return;
    }

    try {
        console.log('Setting up import job...');
        isProcessing = true;
        shouldCancel = false;
        currentJob = {
            id: jobConfig.id,
            config: jobConfig,
            progress: {
                jobId: jobConfig.id,
                phase: 'scanning',
                totalFiles: 0,
                processedFiles: 0,
                successfulFiles: 0,
                failedFiles: 0,
                currentFile: null,
                currentDestination: '',
                bytesProcessed: 0,
                totalBytes: 0,
                errors: []
            }
        };
        
        console.log('Import job setup complete, currentJob:', currentJob);

        sendMessage('progress', currentJob.progress);
        sendMessage('log', { message: 'Starting import process...' });

        // Phase 1: Scan source directory
        console.log('Starting directory scan...');
        await scanSourceDirectory();
        console.log('Directory scan completed');
        
        if (shouldCancel) {
            await handleCancelImport();
            return;
        }

        // Phase 2: Process files to destinations
        await processFiles();

        // Phase 3: Complete
        if (!shouldCancel) {
            currentJob.progress.phase = 'completed';
            sendMessage('progress', currentJob.progress);
            sendMessage('log', { message: 'Import completed successfully!' });
            sendMessage('completed', { 
                jobId: currentJob.id,
                results: currentJob.progress 
            });
        }

    } catch (error) {
        console.error('Import failed:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            toString: error.toString()
        });
        
        if (currentJob) {
            currentJob.progress.phase = 'failed';
            currentJob.progress.errors.push(error.message);
        }
        
        sendMessage('error', { 
            jobId: currentJob?.id,
            error: error.message,
            stack: error.stack,
            errorName: error.name,
            errorDetails: error.toString(),
            progress: currentJob?.progress 
        });
    } finally {
        console.log('Import process cleanup - setting isProcessing to false');
        isProcessing = false;
        currentJob = null;
    }
}

/**
 * Handle cancel import request
 */
async function handleCancelImport() {
    if (!isProcessing) {
        sendMessage('error', { error: 'No import in progress' });
        return;
    }

    shouldCancel = true;
    
    if (currentJob) {
        currentJob.progress.phase = 'cancelled';
        sendMessage('progress', currentJob.progress);
        sendMessage('log', { message: 'Import cancelled by user' });
        sendMessage('cancelled', { 
            jobId: currentJob.id,
            progress: currentJob.progress 
        });
    }

    isProcessing = false;
    currentJob = null;
}

/**
 * Handle get status request
 */
function handleGetStatus() {
    sendMessage('status', {
        isProcessing: isProcessing,
        currentJob: currentJob?.id || null,
        progress: currentJob?.progress || null
    });
}

/**
 * Scan source directory for files
 */
async function scanSourceDirectory() {
    if (!fs || !path) {
        throw new Error('File system access not available');
    }

    const { sourcePath, options } = currentJob.config;
    
    sendMessage('log', { message: `Scanning source directory: ${sourcePath}` });
    currentJob.progress.phase = 'scanning';
    sendMessage('progress', currentJob.progress);

    // Validate source directory
    if (!fs.existsSync(sourcePath)) {
        throw new Error('Source directory does not exist');
    }

    const stats = fs.statSync(sourcePath);
    if (!stats.isDirectory()) {
        throw new Error('Source path is not a directory');
    }

    // Scan for files
    const files = [];
    const supportedExtensions = getAllSupportedExtensions();

    const scanDir = (dirPath, relativePath = '') => {
        if (shouldCancel) return;

        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            if (shouldCancel) return;

            const fullPath = path.join(dirPath, item);
            const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
            
            try {
                const itemStats = fs.statSync(fullPath);

                if (itemStats.isFile()) {
                    const ext = path.extname(item).toLowerCase();
                    
                    // Check if file extension is supported
                    if (supportedExtensions.includes(ext)) {
                        const fileInfo = {
                            name: item,
                            path: fullPath,
                            relativePath: itemRelativePath,
                            size: itemStats.size,
                            type: getFileType(ext),
                            extension: ext,
                            created: itemStats.birthtime,
                            modified: itemStats.mtime
                        };
                        
                        files.push(fileInfo);
                    }
                } else if (itemStats.isDirectory() && options.includeSubdirectories) {
                    // Recursively scan subdirectories if enabled
                    scanDir(fullPath, itemRelativePath);
                }
            } catch (itemError) {
                console.warn(`Failed to process item: ${fullPath}`, itemError);
                sendMessage('log', { message: `Warning: Failed to process ${item}` });
            }
        }
    };

    scanDir(sourcePath);

    if (shouldCancel) return;

    currentJob.files = files;
    currentJob.progress.totalFiles = files.length;
    currentJob.progress.totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    sendMessage('log', { message: `Found ${files.length} files to import` });
    sendMessage('progress', currentJob.progress);

    if (files.length === 0) {
        throw new Error('No supported files found in source directory');
    }
}

/**
 * Process files to all destinations
 */
async function processFiles() {
    currentJob.progress.phase = 'copying';
    sendMessage('progress', currentJob.progress);

    const { destinations, options } = currentJob.config;
    const files = currentJob.files;

    // Create destination instances
    const destinationInstances = createDestinations(destinations);

    // Initialize all destinations
    for (const dest of destinationInstances) {
        if (shouldCancel) return;
        
        try {
            const initialized = await dest.initialize();
            if (!initialized) {
                throw new Error(`Failed to initialize ${dest.getDisplayName()}`);
            }
        } catch (error) {
            sendMessage('log', { message: `Failed to initialize ${dest.getDisplayName()}: ${error.message}` });
            currentJob.progress.errors.push(`${dest.getDisplayName()}: ${error.message}`);
        }
    }

    // Process each file
    for (let i = 0; i < files.length; i++) {
        if (shouldCancel) return;

        const file = files[i];
        currentJob.progress.currentFile = file;
        currentJob.progress.processedFiles = i;
        sendMessage('progress', currentJob.progress);
        sendMessage('log', { message: `Processing: ${file.name}` });

        let fileSuccess = false;
        let localDestinationPath = null;

        // Process file through each destination in priority order
        const sortedDestinations = destinationInstances
            .filter(dest => dest.isReady())
            .sort((a, b) => a.getPriority() - b.getPriority());

        for (const destination of sortedDestinations) {
            if (shouldCancel) return;

            try {
                currentJob.progress.currentDestination = destination.getDisplayName();
                sendMessage('progress', currentJob.progress);

                // For ZenTransfer destination, use the local destination path
                const sourcePath = destination.type === 'zentransfer' && localDestinationPath 
                    ? localDestinationPath 
                    : file.path;

                const result = await destination.processFile(file, sourcePath, options.folderOrganization);

                if (result.success) {
                    sendMessage('log', { message: `✓ ${destination.getDisplayName()}: ${file.name}` });
                    
                    // Store local destination path for ZenTransfer upload
                    if (destination.type === 'local') {
                        localDestinationPath = result.destinationPath;
                    }
                    
                    fileSuccess = true;
                } else {
                    sendMessage('log', { message: `✗ ${destination.getDisplayName()}: ${file.name} - ${result.error}` });
                    currentJob.progress.errors.push(`${file.name} (${destination.getDisplayName()}): ${result.error}`);
                }
            } catch (error) {
                sendMessage('log', { message: `✗ ${destination.getDisplayName()}: ${file.name} - ${error.message}` });
                currentJob.progress.errors.push(`${file.name} (${destination.getDisplayName()}): ${error.message}`);
            }
        }

        // Update progress
        if (fileSuccess) {
            currentJob.progress.successfulFiles++;
        } else {
            currentJob.progress.failedFiles++;
        }
        
        currentJob.progress.bytesProcessed += file.size;
        currentJob.progress.processedFiles = i + 1;
        sendMessage('progress', currentJob.progress);
    }

    // Handle ZenTransfer uploads
    const zenTransferDest = destinationInstances.find(dest => dest.type === 'zentransfer' && dest.isReady());
    if (zenTransferDest && zenTransferDest.getQueueSize() > 0) {
        currentJob.progress.phase = 'uploading';
        currentJob.progress.currentDestination = 'ZenTransfer Upload';
        sendMessage('progress', currentJob.progress);
        sendMessage('log', { message: `Uploading ${zenTransferDest.getQueueSize()} files to ZenTransfer...` });

        // Note: The actual upload will be handled by the main thread
        // We just signal that files are ready for upload
        sendMessage('upload-ready', {
            jobId: currentJob.id,
            queueSize: zenTransferDest.getQueueSize()
        });
    }

    currentJob.progress.currentFile = null;
    currentJob.progress.currentDestination = '';
}

/**
 * Create destination instances
 * @param {Array<DestinationConfig>} destinations - Destination configurations
 * @returns {Array<BaseDestination>} Destination instances
 */
function createDestinations(destinations) {
    const instances = [];

    for (const config of destinations) {
        if (!config.enabled) continue;

        try {
            let destination;
            
            switch (config.type) {
                case 'local':
                    destination = new LocalDestination(config);
                    break;
                case 'backup':
                    destination = new BackupDestination(config);
                    break;
                case 'zentransfer':
                    destination = new ZenTransferDestination(config, null); // Upload manager will be handled in main thread
                    break;
                default:
                    console.warn(`Unknown destination type: ${config.type}`);
                    continue;
            }

            instances.push(destination);
        } catch (error) {
            console.error(`Failed to create destination ${config.type}:`, error);
        }
    }

    return instances;
}

/**
 * Send message to main thread
 * @param {string} type - Message type
 * @param {Object} data - Message data
 */
function sendMessage(type, data) {
    self.postMessage({ type, data });
}

/**
 * Get all supported file extensions
 * @returns {Array<string>} Array of supported extensions
 */
function getAllSupportedExtensions() {
    return [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.raw', '.cr2', '.nef', '.arw', '.dng',
        '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'
    ];
}

/**
 * Get file type from extension
 * @param {string} extension - File extension
 * @returns {string} File type
 */
function getFileType(extension) {
    const ext = extension.toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.raw', '.cr2', '.nef', '.arw', '.dng'];
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'];
    
    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    return 'other';
}

// Simplified destination classes for worker environment
class BaseDestination {
    constructor(config) {
        this.config = config;
        this.type = config.type;
        this.enabled = config.enabled !== false;
    }

    async initialize() { return true; }
    async processFile() { throw new Error('Not implemented'); }
    getDisplayName() { return this.type; }
    getPriority() { return 100; }
    isReady() { return this.enabled; }
    
    getDestinationFolder(fileInfo, folderOrganization) {
        if (!folderOrganization.enabled) return '';
        
        if (folderOrganization.type === 'custom') {
            return folderOrganization.customName || 'Imported Files';
        } else if (folderOrganization.type === 'date') {
            const date = fileInfo.created || new Date();
            return this.formatDateForFolder(date, folderOrganization.dateFormat);
        }
        return '';
    }

    formatDateForFolder(date, format) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthName = monthNames[date.getMonth()];

        switch (format) {
            case '2025/05/26': return `${year}/${month}/${day}`;
            case '2025-05-26': return `${year}-${month}-${day}`;
            case '2025/2025-05-26': return `${year}/${year}-${month}-${day}`;
            case '2025/mai 26': return `${year}/${monthName} ${day}`;
            case '2025/05': return `${year}/${month}`;
            case '2025/mai': return `${year}/${monthName}`;
            case '2025/mai/26': return `${year}/${monthName}/${day}`;
            case '2025/2025-05/2025-05-26': return `${year}/${year}-${month}/${year}-${month}-${day}`;
            case '2025 mai 26': return `${year} ${monthName} ${day}`;
            case '20250526': return `${year}${month}${day}`;
            default: return `${year}/${month}/${day}`;
        }
    }

    joinPath(basePath, ...parts) {
        if (path) {
            return path.join(basePath, ...parts);
        } else {
            const allParts = [basePath, ...parts].filter(part => part && part.length > 0);
            return allParts.join('/').replace(/\/+/g, '/');
        }
    }

    async ensureDirectory(dirPath) {
        if (fs) {
            try {
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
                return true;
            } catch (error) {
                console.error('Failed to create directory:', dirPath, error);
                return false;
            }
        }
        return true;
    }
}

class LocalDestination extends BaseDestination {
    constructor(config) {
        super(config);
        this.destinationPath = config.path;
    }

    async initialize() {
        if (!this.destinationPath) return false;
        return await this.ensureDirectory(this.destinationPath);
    }

    async processFile(fileInfo, sourcePath, folderOrganization) {
        try {
            const folderPath = this.getDestinationFolder(fileInfo, folderOrganization);
            const finalDestinationDir = folderPath 
                ? this.joinPath(this.destinationPath, folderPath)
                : this.destinationPath;

            const dirSuccess = await this.ensureDirectory(finalDestinationDir);
            if (!dirSuccess) {
                return { success: false, destinationPath: '', error: `Failed to create directory: ${finalDestinationDir}` };
            }

            const destinationFilePath = this.joinPath(finalDestinationDir, fileInfo.name);
            
            // Check if file exists and generate unique name if needed
            let finalPath = destinationFilePath;
            if (fs.existsSync(destinationFilePath)) {
                finalPath = this.generateUniqueFilename(destinationFilePath);
            }

            fs.copyFileSync(sourcePath, finalPath);

            return { success: true, destinationPath: finalPath, error: '' };
        } catch (error) {
            return { success: false, destinationPath: '', error: error.message };
        }
    }

    generateUniqueFilename(filePath) {
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const nameWithoutExt = path.basename(filePath, ext);
        
        let counter = 1;
        let uniquePath;
        
        do {
            uniquePath = path.join(dir, `${nameWithoutExt} (${counter})${ext}`);
            counter++;
        } while (fs.existsSync(uniquePath));
        
        return uniquePath;
    }

    getDisplayName() { return 'Local Destination'; }
    getPriority() { return 1; }
    isReady() { return this.enabled && this.destinationPath; }
}

class BackupDestination extends BaseDestination {
    constructor(config) {
        super(config);
        this.backupPath = config.path;
    }

    async initialize() {
        if (!this.backupPath) return false;
        return await this.ensureDirectory(this.backupPath);
    }

    async processFile(fileInfo, sourcePath, folderOrganization) {
        try {
            const folderPath = this.getDestinationFolder(fileInfo, folderOrganization);
            const finalBackupDir = folderPath 
                ? this.joinPath(this.backupPath, folderPath)
                : this.backupPath;

            const dirSuccess = await this.ensureDirectory(finalBackupDir);
            if (!dirSuccess) {
                return { success: false, destinationPath: '', error: `Failed to create backup directory: ${finalBackupDir}` };
            }

            const backupFilePath = this.joinPath(finalBackupDir, fileInfo.name);
            
            // Check if file exists and generate unique name if needed
            let finalPath = backupFilePath;
            if (fs.existsSync(backupFilePath)) {
                finalPath = this.generateUniqueFilename(backupFilePath);
            }

            fs.copyFileSync(sourcePath, finalPath);

            return { success: true, destinationPath: finalPath, error: '' };
        } catch (error) {
            return { success: false, destinationPath: '', error: error.message };
        }
    }

    generateUniqueFilename(filePath) {
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const nameWithoutExt = path.basename(filePath, ext);
        
        let counter = 1;
        let uniquePath;
        
        do {
            uniquePath = path.join(dir, `${nameWithoutExt} (${counter})${ext}`);
            counter++;
        } while (fs.existsSync(uniquePath));
        
        return uniquePath;
    }

    getDisplayName() { return 'Backup'; }
    getPriority() { return 50; }
    isReady() { return this.enabled && this.backupPath; }
}

class ZenTransferDestination extends BaseDestination {
    constructor(config, uploadManager) {
        super(config);
        this.filesToUpload = [];
    }

    async initialize() { return true; }

    async processFile(fileInfo, sourcePath, folderOrganization) {
        this.filesToUpload.push({
            filePath: sourcePath,
            fileInfo: fileInfo,
            folderOrganization: folderOrganization
        });

        return {
            success: true,
            destinationPath: sourcePath,
            error: '',
            metadata: { queuedForUpload: true }
        };
    }

    getDisplayName() { return 'ZenTransfer Upload'; }
    getPriority() { return 200; }
    isReady() { return this.enabled; }
    getQueueSize() { return this.filesToUpload.length; }
} 