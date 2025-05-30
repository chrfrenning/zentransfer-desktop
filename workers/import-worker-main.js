/**
 * Import Worker for Main Process
 * Node.js worker thread for handling file import operations
 */

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const workerId = workerData.workerId;
let currentJob = null;
let isProcessing = false;
let shouldCancel = false;

console.log(`Import worker ${workerId} started`);

// Message handler
parentPort.on('message', async (message) => {
    const { type } = message;
    
    // Handle cancellation immediately
    if (type === 'cancel-import') {
        // Set the cancellation flag so in-flight operations can notice
        shouldCancel = true;
    }
    
    console.log(`Import worker ${workerId}: Received message type: ${type}`);
    
    try {
        switch (type) {
            case 'start-import':
                console.log(`Import worker ${workerId}: Handling start-import`);
                await handleStartImport(message);
                break;
            case 'cancel-import':
                console.log(`Import worker ${workerId}: Handling cancel-import`);
                await handleCancelImport();
                break;
            default:
                console.log(`Import worker ${workerId}: Unknown message type: ${type}`);
                sendMessage('error', { error: `Unknown message type: ${type}` });
        }
    } catch (error) {
        console.error(`Import worker ${workerId} error:`, error);
        sendMessage('error', { 
            error: error.message,
            stack: error.stack 
        });
    }
});

/**
 * Handle start import request
 */
async function handleStartImport(message) {
    const { importSettings } = message;
    
    console.log(`Import worker ${workerId}: handleStartImport called, isProcessing: ${isProcessing}`);
    
    if (isProcessing) {
        console.log(`Import worker ${workerId}: Import already in progress, sending error`);
        sendMessage('error', { error: 'Import already in progress' });
        return;
    }
    
    try {
        console.log(`Import worker ${workerId}: Setting isProcessing to true and resetting shouldCancel`);
        isProcessing = true;
        shouldCancel = false; // Reset cancellation flag for new import
        currentJob = { importSettings };
        console.log(`Import worker ${workerId}: Current job set:`, currentJob);
        
        sendMessage('log', { message: 'Starting import process...' });
        sendMessage('log', { message: `Source: ${importSettings.sourcePath}` });
        sendMessage('log', { message: `Destination: ${importSettings.destinationPath}` });
        
        if (importSettings.backupEnabled) {
            sendMessage('log', { message: `Backup: ${importSettings.backupPath}` });
        }
        
        // Log enabled upload services
        const enabledServices = [];
        if (importSettings.uploadToZenTransfer) {
            enabledServices.push('ZenTransfer');
        }
        if (importSettings.uploadToAwsS3) {
            enabledServices.push('AWS S3');
        }
        if (importSettings.uploadToAzure) {
            enabledServices.push('Azure Blob Storage');
        }
        if (importSettings.uploadToGcp) {
            enabledServices.push('Google Cloud Storage');
        }
        
        if (enabledServices.length > 0) {
            sendMessage('log', { message: `Upload services enabled: ${enabledServices.join(', ')}` });
        }
        
        // Phase 1: Scan source directory
        console.log(`Import worker ${workerId}: Starting directory scan, isProcessing: ${isProcessing}`);
        sendMessage('log', { message: 'Scanning source directory...' });
        const files = await scanSourceDirectory(importSettings);
        
        console.log(`Import worker ${workerId}: Directory scan complete, found ${files.length} files, isProcessing: ${isProcessing}`);
        
        // Check if we were cancelled during scanning
        if (!isProcessing) {
            console.log(`Import worker ${workerId}: Cancelled during scanning, returning`);
            sendMessage('log', { message: 'Import cancelled during directory scanning' });
            return;
        }
        
        if (files.length === 0) {
            sendMessage('log', { message: 'No supported files found' });
            sendMessage('completed', { 
                result: { 
                    totalFiles: 0, 
                    successfulFiles: 0, 
                    failedFiles: 0 
                } 
            });
            return;
        }
        
        sendMessage('log', { message: `Found ${files.length} files to import` });
        sendMessage('progress', {
            totalFiles: files.length,
            processedFiles: 0,
            successfulFiles: 0,
            failedFiles: 0,
            phase: 'copying'
        });
        
        // Phase 2: Process files
        console.log(`Import worker ${workerId}: Starting file processing, isProcessing: ${isProcessing}`);
        const results = await processFiles(files, importSettings);
        
        console.log(`Import worker ${workerId}: File processing complete, isProcessing: ${isProcessing}`);
        
        // Phase 3: Complete
        sendMessage('log', { message: 'Import completed!' });
        sendMessage('completed', { result: results });
        
    } catch (error) {
        console.error(`Import worker ${workerId}: Import failed:`, error);
        sendMessage('error', { 
            error: error.message,
            stack: error.stack 
        });
    } finally {
        console.log(`Import worker ${workerId}: Finally block - resetting all state`);
        isProcessing = false;
        shouldCancel = false; // Reset cancellation flag
        currentJob = null;
    }
}

/**
 * Handle cancel import request
 */
async function handleCancelImport() {
    console.log(`Import worker ${workerId}: Received cancellation request`);
    
    if (!isProcessing) {
        console.log(`Import worker ${workerId}: No import in progress`);
        sendMessage('error', { error: 'No import in progress' });
        return;
    }
    
    console.log(`Import worker ${workerId}: Stopping import process...`);
    isProcessing = false;
    currentJob = null;
    
    sendMessage('log', { message: 'Import stopped by user' });
    sendMessage('cancelled', {});
    console.log(`Import worker ${workerId}: Cancellation complete`);
}

/**
 * Scan source directory for supported files
 */
async function scanSourceDirectory(importSettings) {
    const { sourcePath, includeSubdirectories } = importSettings;
    
    if (!fs.existsSync(sourcePath)) {
        throw new Error('Source directory does not exist');
    }
    
    const stats = fs.statSync(sourcePath);
    if (!stats.isDirectory()) {
        throw new Error('Source path is not a directory');
    }
    
    const files = [];
    const supportedExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.raw', '.cr2', '.nef', '.arw', '.dng',
        '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'
    ];
    
    const scanDir = (dirPath, relativePath = '') => {
        // Check for cancellation before scanning each directory
        if (!isProcessing) {
            console.log(`Import worker ${workerId}: Cancellation detected in scanDir for ${dirPath}`);
            return; // Stop scanning if cancelled
        }
        
        const items = fs.readdirSync(dirPath);
        console.log(`Import worker ${workerId}: Scanning directory ${dirPath}, found ${items.length} items, isProcessing: ${isProcessing}`);
        
        for (const item of items) {
            // Check for cancellation periodically during scanning
            if (!isProcessing) {
                console.log(`Import worker ${workerId}: Cancellation detected during item scan in ${dirPath}`);
                return; // Stop scanning if cancelled
            }
            
            const fullPath = path.join(dirPath, item);
            const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
            
            try {
                const itemStats = fs.statSync(fullPath);
                
                if (itemStats.isFile()) {
                    const ext = path.extname(item).toLowerCase();
                    if (supportedExtensions.includes(ext)) {
                        files.push({
                            name: item,
                            path: fullPath,
                            relativePath: itemRelativePath,
                            size: itemStats.size,
                            created: itemStats.birthtime,
                            modified: itemStats.mtime
                        });
                    }
                } else if (itemStats.isDirectory() && includeSubdirectories) {
                    scanDir(fullPath, itemRelativePath);
                }
            } catch (itemError) {
                console.warn(`Failed to process item: ${fullPath}`, itemError);
            }
        }
    };
    
    scanDir(sourcePath);
    return files;
}

/**
 * Process files to destinations
 */
async function processFiles(files, importSettings) {
    const { destinationPath, backupEnabled, backupPath, organizeIntoFolders, folderOrganizationType, customFolderName, dateFormat, uploadToZenTransfer, skipDuplicates } = importSettings;
    
    console.log(`Import worker ${workerId}: processFiles called with ${files.length} files, skipDuplicates: ${skipDuplicates}, isProcessing: ${isProcessing}`);
    console.log(`Import worker ${workerId}: Full importSettings:`, JSON.stringify(importSettings, null, 2));
    
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0; // Track skipped duplicates
    let uploadQueueCount = 0; // Track total files queued for upload
    
    for (let i = 0; i < files.length; i++) {
        console.log(`Import worker ${workerId}: Processing file ${i + 1}/${files.length}, isProcessing: ${isProcessing}`);
        if (shouldCancel) {
            console.log(`Import worker ${workerId}: Cancellation detected before processing file index ${i}`);
            break;
        }
        
        const file = files[i];
        
        try {
            console.log(`Import worker ${workerId}: Starting to process file: ${file.name}, isProcessing: ${isProcessing}`);
            sendMessage('log', { message: `Processing: ${file.name}` });
            
            // Determine destination folder
            let finalDestinationPath = destinationPath;
            let finalBackupPath = backupPath;
            
            if (organizeIntoFolders) {
                const folderName = getFolderName(file, folderOrganizationType, customFolderName, dateFormat);
                finalDestinationPath = path.join(destinationPath, folderName);
                if (backupEnabled && backupPath) {
                    finalBackupPath = path.join(backupPath, folderName);
                }
            }
            
            // Copy to destination
            console.log(`Import worker ${workerId}: About to copy file ${file.name}, isProcessing: ${isProcessing}`);
            const destinationFilePath = await copyFileAsync(file, finalDestinationPath, skipDuplicates);
            
            let destinationSkipped = false;
            
            // Check if file was skipped in destination
            if (destinationFilePath === null) {
                // File was skipped as duplicate in destination
                destinationSkipped = true;
                skippedCount++;
                console.log(`Import worker ${workerId}: File skipped as duplicate in destination: ${file.name}, skippedCount: ${skippedCount}`);
                sendMessage('log', { message: `⚠ Skipped duplicate in destination: ${file.name}` });
            } else {
                console.log(`Import worker ${workerId}: File copied successfully to destination: ${file.name}, isProcessing: ${isProcessing}`);
                sendMessage('log', { message: `✓ Copied to destination: ${file.name}` });
            }
            
            // Check for cancellation after destination copying
            if (!isProcessing) {
                console.log(`Import worker ${workerId}: Cancellation detected after copying ${file.name}`);
                break;
            }
            
            // Queue for upload to enabled cloud services (only if successfully copied to destination)
            const hasAnyUploadEnabled = uploadToZenTransfer || importSettings.uploadToAwsS3 || importSettings.uploadToAzure || importSettings.uploadToGcp;
            if (hasAnyUploadEnabled && destinationFilePath) {
                console.log(`Import worker ${workerId}: About to queue for upload: ${file.name}, isProcessing: ${isProcessing}`);
                sendMessage('upload-ready', {
                    filePaths: [destinationFilePath], // Single file array
                    count: 1,
                    fileName: file.name, // Include filename for logging
                    importSettings: importSettings // Pass import settings to determine which services to use
                });
                uploadQueueCount++;
                console.log(`Import worker ${workerId}: File queued for upload: ${file.name}, uploadQueueCount: ${uploadQueueCount}`);
                sendMessage('log', { message: `✓ Queued for upload: ${file.name}` });
            }
            
            // Check for cancellation after upload queuing
            if (!isProcessing) {
                console.log(`Import worker ${workerId}: Cancellation detected after queuing upload for ${file.name}`);
                break;
            }
            
            // Copy to backup if enabled (check for duplicates in backup independently)
            let backupSkipped = false;
            if (backupEnabled && finalBackupPath) {
                const backupFilePath = await copyFileAsync(file, finalBackupPath, skipDuplicates);
                if (backupFilePath !== null) {
                    sendMessage('log', { message: `✓ Backed up: ${file.name}` });
                } else {
                    backupSkipped = true;
                    sendMessage('log', { message: `⚠ Backup skipped (duplicate): ${file.name}` });
                }
            }
            
            // Check for cancellation after backup
            if (!isProcessing) {
                console.log(`Import worker ${workerId}: Cancellation detected after backup for ${file.name}`);
                break;
            }
            
            // Count as successful if copied to either destination or backup (or both)
            if (!destinationSkipped || !backupSkipped) {
                successCount++;
                console.log(`Import worker ${workerId}: File processing completed: ${file.name}, successCount: ${successCount}`);
                sendMessage('log', { message: `✓ Completed: ${file.name}` });
            } else {
                // Both destination and backup were skipped
                console.log(`Import worker ${workerId}: File skipped in both destination and backup: ${file.name}`);
                sendMessage('log', { message: `⚠ Skipped (duplicate in both locations): ${file.name}` });
            }
            
        } catch (error) {
            console.error(`Import worker ${workerId}: Failed to process file:`, file.name, error);
            failCount++;
            sendMessage('log', { message: `✗ Failed: ${file.name} - ${error.message}` });
        }
        
        // Send progress update after processing each file
        sendMessage('progress', {
            totalFiles: files.length,
            processedFiles: i + 1,
            successfulFiles: successCount,
            failedFiles: failCount,
            skippedFiles: skippedCount,
            uploadQueueCount: uploadQueueCount,
            phase: 'copying'
        });
    }
    
    // Check if we were cancelled
    const wasCancelled = !isProcessing;
    
    // Log final upload summary if any files were queued
    const hasAnyUploadEnabled = uploadToZenTransfer || importSettings.uploadToAwsS3 || importSettings.uploadToAzure || importSettings.uploadToGcp;
    if (hasAnyUploadEnabled && uploadQueueCount > 0) {
        sendMessage('log', { message: `Total files queued for upload: ${uploadQueueCount}` });
    }
    
    // Log summary including skipped files
    if (skippedCount > 0) {
        sendMessage('log', { message: `${skippedCount} duplicate files were skipped` });
    }
    
    if (wasCancelled) {
        sendMessage('log', { message: `Import stopped - processed ${successCount} of ${files.length} files (${skippedCount} skipped)` });
    }
    
    return {
        totalFiles: files.length,
        successfulFiles: successCount,
        failedFiles: failCount,
        skippedFiles: skippedCount,
        uploadQueueCount: uploadQueueCount,
        phase: wasCancelled ? 'cancelled' : 'completed',
        wasCancelled: wasCancelled
    };
}

/**
 * Check if a file already exists and is a duplicate
 * @param {Object} sourceFile - Source file object with path, name, and size
 * @param {string} destinationPath - Destination file path to check
 * @returns {boolean} True if file exists and is a duplicate
 */
function isDuplicateFile(sourceFile, destinationPath) {
    if (!fs.existsSync(destinationPath)) {
        return false; // File doesn't exist, not a duplicate
    }
    
    try {
        const destinationStats = fs.statSync(destinationPath);
        
        // Check if file sizes match (basic duplicate detection)
        if (sourceFile.size === destinationStats.size) {
            console.log(`Import worker ${workerId}: Duplicate detected - ${sourceFile.name} (size: ${sourceFile.size} bytes)`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn(`Import worker ${workerId}: Failed to check duplicate for ${destinationPath}:`, error);
        return false; // If we can't check, assume not duplicate
    }
}

/**
 * Copy file to destination
 */
async function copyFileAsync(file, destinationDir, skipDuplicates = true) {
    console.log(`Import worker ${workerId}: copyFileAsync called for ${file.name}, skipDuplicates: ${skipDuplicates}`);
    
    // Ensure destination directory exists
    if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
    }
    
    const destinationFile = path.join(destinationDir, file.name);
    
    // Check if file already exists
    if (fs.existsSync(destinationFile)) {
        console.log(`Import worker ${workerId}: File ${file.name} already exists at destination`);
        if (skipDuplicates && isDuplicateFile(file, destinationFile)) {
            // File is a duplicate and we're skipping duplicates
            console.log(`Import worker ${workerId}: Skipping duplicate file: ${file.name}`);
            sendMessage('log', { message: `⚠ Skipped duplicate: ${file.name}` });
            return null; // Return null to indicate file was skipped
        } else {
            // File exists but either we're not skipping duplicates or it's not a duplicate
            // Generate unique name
            console.log(`Import worker ${workerId}: Generating unique filename for: ${file.name} (skipDuplicates: ${skipDuplicates})`);
            const finalPath = generateUniqueFilename(destinationFile);
            await fs.promises.copyFile(file.path, finalPath);
            return finalPath;
        }
    } else {
        // File doesn't exist, copy normally
        console.log(`Import worker ${workerId}: File ${file.name} doesn't exist, copying normally`);
        await fs.promises.copyFile(file.path, destinationFile);
        return destinationFile;
    }
}

/**
 * Generate unique filename if file already exists
 */
function generateUniqueFilename(filePath) {
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

/**
 * Get folder name for file organization
 */
function getFolderName(file, type, customName, dateFormat) {
    if (type === 'custom') {
        return customName || 'Imported Files';
    } else {
        // Use file creation date or current date
        const date = file.created ? new Date(file.created) : new Date();
        return formatDateForFolder(date, dateFormat);
    }
}

/**
 * Format date according to the selected format
 */
function formatDateForFolder(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthName = monthNames[date.getMonth()];

    switch (format) {
        case '2025/05/26': return `${year}/${month}/${day}`;
        case '2025-05-26': return `${year}-${month}-${day}`;
        case '2025/2025-05-26': return `${year}/${year}-${month}-${day}`;
        case '2025/may 26': return `${year}/${monthName} ${day}`;
        case '2025/05': return `${year}/${month}`;
        case '2025/may': return `${year}/${monthName}`;
        case '2025/may/26': return `${year}/${monthName}/${day}`;
        case '2025/2025-05/2025-05-26': return `${year}/${year}-${month}/${year}-${month}-${day}`;
        case '2025 may 26': return `${year} ${monthName} ${day}`;
        case '20250526': return `${year}${month}${day}`;
        default: return `${year}/${month}/${day}`;
    }
}

/**
 * Send message to main thread
 */
function sendMessage(type, data) {
    parentPort.postMessage({ type, ...data });
} 