/**
 * Import Worker for Main Process
 * Node.js worker thread for handling file import operations
 */

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const logger = require('./WorkerLogger.js');
const { calculateFileHash } = require('../utils/Checksums.js');
const { MetadataService } = require('../services/MetadataService.js');
const { ThumbnailService } = require('../services/ThumbnailService.js');
const { DateFormatter } = require('../utils/DateFormatter.js');

const workerId = workerData.workerId;
let currentJob = null;
let isProcessing = false;
let shouldCancel = false;

logger.info(`Import worker ${workerId} started`);

const MAKE_BACKUPS_FROM_SOURCE = false;
const MIRROR_STYLE_BACKUP_ORGANIZATION = false; // mutex with DATE_STYLE_BACKUP_ORGANIZATION
const DATE_STYLE_BACKUP_ORGANIZATION = false; // mutex with MIRROR_STYLE_BACKUP_ORGANIZATION
const LR_STYLE_BACKUP_ORGANIZATION = true; // mutex with DATE_STYLE_BACKUP_ORGANIZATION and MIRROR_STYLE_BACKUP_ORGANIZATION
const VERIFY_WITH_HASH = true;
const HASH_ALGORITHM = 'md5';

/*
 * Message handling, we're a worker thread, receiving
 * messages about files to process (copy) from the main thread,
 * and we let it know when we're done by sending a completion message
 */

parentPort.on('message', async (message) => {
    const { type } = message;
    
    logger.info(`Received message type: ${type}`);
    
    try {

        switch (type) {
            case 'import-file':
                const { file, configuration } = message;
                logger.info(`Import worker ${workerId}: Handling start-import`);
                await handleStartImport(file, configuration);
                break;
                
            default:
                logger.info(`Ignoring unknown message type: ${type}`);
        }

    } catch (error) {

        console.error(`Import worker ${workerId} dies with error: ${error.message}`);
        throw error;
    }
});

function sendMessageToParent(type, data) {
    parentPort.postMessage({ type, ...data });
}

/**
 * Handle start import request
 */
async function handleStartImport(fileWithSettings, configuration) {
    
    const metadataService = new MetadataService();
    const thumbnailService = new ThumbnailService();

    try {

        const result = await doImport(fileWithSettings, configuration, metadataService, thumbnailService);

        sendMessageToParent('completed', {
            result: result,
            file: fileWithSettings.file,
            settings: fileWithSettings.settings,
            success: true
        });

    } catch (error) {

        console.error(`Import of ${fileWithSettings.name} failed: ${error.message}`);

        // TODO: Must send a message about this so we can inform the user

        sendMessageToParent('completed', {
            file: fileWithSettings.file,
            success: false
        });

    } finally {

        metadataService.cleanup();

    }
}

async function doImport(fileWithSettings, configuration, metadataService, thumbnailService) {
    
    logger.info(`Doing import of ${fileWithSettings.file.name}`);

    const { file, settings } = fileWithSettings;

    //console.log(file);
    //console.log(settings);
    //console.log(configuration);

    // Calculate a hash of the source file
    const sourceHash = VERIFY_WITH_HASH ? await calculateFileHash(file.path, HASH_ALGORITHM) : null;
    


    /*  
     *  Read metadata of the source file if we will need it 
     *  
    */

    let metadataFailure = false;
    let fileDateToUse = file.created;
    if ( configuration.preferences.tryMetadataDate || true ) {

        logger.verbose(`Trying to read metadata of the source file ${file.name} to use creation date`);

        const { success, metadata : extractedMetadata } = await metadataService.extractMetadata(file.path);
        if ( success ) {
            const date = MetadataService.getBestDateFromMetadata(extractedMetadata.metadata);
            if ( date ) {
                fileDateToUse = date;

                logger.info(`Using metadata date for ${file.name}: ${fileDateToUse}`);
            }
        } else {
            metadataFailure = true; // let rest of process know not to try again
        }
    }



    /*  
     *  Compose the destination path and make sure it exists 
     *  
    */

    let destinationFolder = settings.destinationPath;

    // Default is mirroring the source folder structure
    if ( path.dirname(file.relativePath) != '.' ) {
        destinationFolder = path.join(destinationFolder, path.dirname(file.relativePath));
    }

    if ( configuration.preferences.flattenFolders ) {
        destinationFolder = path.join(destinationFolder);
    }

    if ( settings.prefixFolderName ) {
        destinationFolder = path.join(destinationFolder, settings.prefixFolderName);
    }

    if ( true || (settings.organizeIntoFolders == 'date' && settings.dateFormat) ) {
        const dateRelativePath = DateFormatter.formatDate(fileDateToUse, settings.dateFormat);
        destinationFolder = path.join(destinationFolder, ...dateRelativePath.split('/'));
    }

    if ( settings.postFixFolderName ) {
        destinationFolder = path.join(destinationFolder, settings.postFixFolderName);
    }


    // Make sure the destination folder exists
    if (!fs.existsSync(destinationFolder)) {
        fs.mkdirSync(destinationFolder, { recursive: true });
    }
    


    /*  
     *  Compose the destination filename and check if it exists 
     *  
    */

    let destinationPath = path.join(destinationFolder, file.name);

    if (fs.existsSync(destinationPath)) {
        logger.debug(`File ${file.name} already exists at destination`);
        if ( configuration.preferences.skipExisting ) {
            return { operation: 'skipped' };
        } else {
            do {
                destinationPath = generateUniqueFilename(destinationPath);
            } while (fs.existsSync(destinationPath));

            logger.debug(`Generated unique filename for: ${file.name} -> ${destinationPath}`);
        }
    }
    


    /*  
     *  Copy the file to the destination
     *  
    */

    try {

        await fs.promises.copyFile(file.path, destinationPath);

        const destinationHash = VERIFY_WITH_HASH ? await calculateFileHash(destinationPath, HASH_ALGORITHM) : null;
        if ( destinationHash !== sourceHash ) {
            logger.error(`Hash mismatch for backup file ${file.name} - source: ${sourceHash}, destination: ${destinationHash}`);
            return { operation: 'failed', error: 'Hash mismatch' };
        }

    } catch (error) {
        logger.error(`Error copying file ${file.name} to ${destinationPath}: ${error.message}`);
        return { operation: 'failed', error: error.message };
    }
    


    /*  
     *  Make a backup copy
     *  
    */

    if ( settings.enableBackup && settings.backupPath ) {

        // This is a speedup trick, but less secure ofc
        const backupSource = MAKE_BACKUPS_FROM_SOURCE ? file.path : destinationPath;

        // Compose the backup path
        let backupFolder = settings.backupPath;
        if ( path.dirname(file.relativePath) != '.' ) {
            backupFolder = path.join(backupFolder, path.dirname(file.relativePath));
        }

        if ( DATE_STYLE_BACKUP_ORGANIZATION ) {
            backupFolder = path.join(backupFolder, file.created.getFullYear().toString(), file.created.getMonth().toString().padStart(2, '0'), file.created.getDate().toString().padStart(2, '0'));
        } else if ( MIRROR_STYLE_BACKUP_ORGANIZATION ) {
            backupFolder = path.join(backupFolder, path.dirname(file.relativePath));
        } else if ( LR_STYLE_BACKUP_ORGANIZATION ) {
            const now = new Date();
            const sessionFolderName = `Imported at ${now.toISOString().split('T')[0]}`;
            backupFolder = path.join(backupFolder, sessionFolderName);
        }

        // Make sure the backup folder exists
        if (!fs.existsSync(backupFolder)) {
            fs.mkdirSync(backupFolder, { recursive: true });
        }

        // Compose the backup filename
        let backupFilename = path.join(backupFolder, file.relativePath);

        // Check if the backup file already exists
        if (!fs.existsSync(backupFilename)) {

            // Copy the file to the backup
            try {

                await fs.promises.copyFile(backupSource, backupFilename);

                const destinationHash = VERIFY_WITH_HASH ? await calculateFileHash(backupFilename, HASH_ALGORITHM) : null;
                if ( destinationHash !== sourceHash ) {
                    logger.error(`Hash mismatch for backup file ${file.name} - source: ${sourceHash}, destination: ${destinationHash}`);
                    return { operation: 'failed', error: 'Hash mismatch' };
                }

            } catch (error) {
                logger.error(`Error copying file ${file.name} to ${backupFilename}: ${error.message}`);
                return { operation: 'failed', error: error.message };
            }

        }
    }


    // Proceed with more magic


    // Add this to the dedupe database

    return { 
        operation: 'completed',
        destinationPath: destinationPath
    };
}



/**
 * Process files to destinations
 */
async function processFiles(files, importSettings) {
    const { destinationPath, backupEnabled, backupPath, organizeIntoFolders, folderOrganizationType, customFolderName, dateFormat, uploadToZenTransfer, skipDuplicates } = importSettings;
    
    logger.info(`Import worker ${workerId}: processFiles called with ${files.length} files, skipDuplicates: ${skipDuplicates}, isProcessing: ${isProcessing}`);
    logger.info(`Import worker ${workerId}: Full importSettings:`, JSON.stringify(importSettings, null, 2));
    
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0; // Track skipped duplicates
    let uploadQueueCount = 0; // Track total files queued for upload
    
    for (let i = 0; i < files.length; i++) {
        logger.info(`Import worker ${workerId}: Processing file ${i + 1}/${files.length}, isProcessing: ${isProcessing}`);
        if (shouldCancel) {
            logger.info(`Import worker ${workerId}: Cancellation detected before processing file index ${i}`);
            break;
        }
        
        const file = files[i];
        
        try {
            logger.info(`Import worker ${workerId}: Starting to process file: ${file.name}, isProcessing: ${isProcessing}`);
            sendMessageToParent('log', { message: `Processing: ${file.name}` });
            
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
            logger.info(`Import worker ${workerId}: About to copy file ${file.name}, isProcessing: ${isProcessing}`);
            const destinationFilePath = await copyFileAsync(file, finalDestinationPath, skipDuplicates);
            
            let destinationSkipped = false;
            
            // Check if file was skipped in destination
            if (destinationFilePath === null) {
                // File was skipped as duplicate in destination
                destinationSkipped = true;
                skippedCount++;
                logger.info(`Import worker ${workerId}: File skipped as duplicate in destination: ${file.name}, skippedCount: ${skippedCount}`);
                sendMessageToParent('log', { message: `⚠ Skipped duplicate in destination: ${file.name}` });
            } else {
                logger.info(`Import worker ${workerId}: File copied successfully to destination: ${file.name}, isProcessing: ${isProcessing}`);
                sendMessageToParent('log', { message: `✓ Copied to destination: ${file.name}` });
            }
            
            // Check for cancellation after destination copying
            if (!isProcessing) {
                logger.info(`Import worker ${workerId}: Cancellation detected after copying ${file.name}`);
                break;
            }
            
            // Queue for upload to enabled cloud services (only if successfully copied to destination)
            const hasAnyUploadEnabled = uploadToZenTransfer || importSettings.uploadToAwsS3 || importSettings.uploadToAzure || importSettings.uploadToGcp || importSettings.uploadToMinio;
            if (hasAnyUploadEnabled && destinationFilePath) {
                logger.info(`Import worker ${workerId}: About to queue for upload: ${file.name}, isProcessing: ${isProcessing}`);
                sendMessageToParent('upload-ready', {
                    filePaths: [destinationFilePath], // Single file array
                    count: 1,
                    fileName: file.name, // Include filename for logging
                    importSettings: importSettings // Pass import settings to determine which services to use
                });
                uploadQueueCount++;
                logger.info(`Import worker ${workerId}: File queued for upload: ${file.name}, uploadQueueCount: ${uploadQueueCount}`);
                sendMessageToParent('log', { message: `✓ Queued for upload: ${file.name}` });
            }
            
            // Check for cancellation after upload queuing
            if (!isProcessing) {
                logger.info(`Import worker ${workerId}: Cancellation detected after queuing upload for ${file.name}`);
                break;
            }
            
            // Copy to backup if enabled (check for duplicates in backup independently)
            let backupSkipped = false;
            if (backupEnabled && finalBackupPath) {
                const backupFilePath = await copyFileAsync(file, finalBackupPath, skipDuplicates);
                if (backupFilePath !== null) {
                    sendMessageToParent('log', { message: `✓ Backed up: ${file.name}` });
                } else {
                    backupSkipped = true;
                    sendMessageToParent('log', { message: `⚠ Backup skipped (duplicate): ${file.name}` });
                }
            }
            
            // Check for cancellation after backup
            if (!isProcessing) {
                logger.info(`Import worker ${workerId}: Cancellation detected after backup for ${file.name}`);
                break;
            }
            
            // Count as successful if copied to either destination or backup (or both)
            if (!destinationSkipped || !backupSkipped) {
                successCount++;
                logger.info(`Import worker ${workerId}: File processing completed: ${file.name}, successCount: ${successCount}`);
                sendMessageToParent('log', { message: `✓ Completed: ${file.name}` });
            } else {
                // Both destination and backup were skipped
                logger.info(`Import worker ${workerId}: File skipped in both destination and backup: ${file.name}`);
                sendMessageToParent('log', { message: `⚠ Skipped (duplicate in both locations): ${file.name}` });
            }
            
        } catch (error) {
            console.error(`Import worker ${workerId}: Failed to process file:`, file.name, error);
            failCount++;
            sendMessageToParent('log', { message: `✗ Failed: ${file.name} - ${error.message}` });
        }
        
        // Send progress update after processing each file
        sendMessageToParent('progress', {
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
    const hasAnyUploadEnabled = uploadToZenTransfer || importSettings.uploadToAwsS3 || importSettings.uploadToAzure || importSettings.uploadToGcp || importSettings.uploadToMinio;
    if (hasAnyUploadEnabled && uploadQueueCount > 0) {
        sendMessageToParent('log', { message: `Total files queued for upload: ${uploadQueueCount}` });
    }
    
    // Log summary including skipped files
    if (skippedCount > 0) {
        sendMessageToParent('log', { message: `${skippedCount} duplicate files were skipped` });
    }
    
    if (wasCancelled) {
        sendMessageToParent('log', { message: `Import stopped - processed ${successCount} of ${files.length} files (${skippedCount} skipped)` });
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
            logger.info(`Import worker ${workerId}: Duplicate detected - ${sourceFile.name} (size: ${sourceFile.size} bytes)`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn(`Import worker ${workerId}: Failed to check duplicate for ${destinationPath}:`, error);
        return false; // If we can't check, assume not duplicate
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
        uniquePath = path.join(dir, `${nameWithoutExt} [${counter}]${ext}`);
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