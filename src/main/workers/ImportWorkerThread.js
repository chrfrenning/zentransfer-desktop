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
const { MimeTypesService } = require('../services/MimeTypesService.js');

const workerId = workerData.workerId;
let currentJob = null;
let isProcessing = false;
let shouldCancel = false;

logger.info(`Import worker ${workerId} started`);

const mimeTypeService = new MimeTypesService();

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

    // This is the mother of all functions. Good luck reading it!!!
    
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
    let readMetadata = null;
    if ( configuration.preferences.tryMetadataDate || true ) {

        logger.verbose(`Trying to read metadata of the source file ${file.name} to use creation date`);

        const { success, metadata : extractedMetadata } = await metadataService.extractMetadata(file.path);
        if ( success ) {
            const date = MetadataService.getBestDateFromMetadata(extractedMetadata.metadata);
            if ( date ) {
                fileDateToUse = date;

                logger.info(`Using metadata date for ${file.name}: ${fileDateToUse}`);
            }

            readMetadata = extractedMetadata;
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
    


    /*  
     *  Extract and save metadata
     *  
    */

    if ( configuration.preferences.extractMetaData ) {
        if ( !readMetadata ) {
            if ( !metadataFailure ) {
                const { success, metadata : extractedMetadata } = await metadataService.extractMetadata(file.path);
                if ( success ) {
                    readMetadata = extractedMetadata;
                }
            }
        }

        if ( readMetadata ) {
            let metadataFilename = MetadataService.generateMetadataFilename(destinationPath);
            await fs.promises.writeFile(metadataFilename, JSON.stringify(readMetadata, null, 2));
        }
    }
    


    /*  
     *  Create thumbnail and preview
     *  
    */

    let pinkieNail = null;

    if ( configuration.preferences.createPreviews ) {
        const options = {
            size: configuration.preferences.previewSize,
            quality: configuration.preferences.previewQuality
        };

        const preview = await thumbnailService.generatePreview(file.path, options);
        if ( preview.success ) {
            const previewFilename = thumbnailService.generatePreviewFilename(destinationPath);
            await fs.promises.writeFile(previewFilename, preview.buffer);

            // create the thumbnail from the preview
            const options = {
                size: configuration.preferences.thumbnailSize,
                quality: configuration.preferences.thumbnailQuality
            };

            // Note! We have a strange bug here from time to time where previewFilename gets locked 
            // until the process exits, that does not happen when we create the thumbnail from the original
            // file. While slower, we start from scratch from the original also for the thumb.
            const thumbnail = await thumbnailService.generatePreview(destinationPath/* previewFilename */, options);
            if ( thumbnail.success ) {
                const thumbnailFilename = thumbnailService.generateThumbnailFilename(destinationPath);
                await fs.promises.writeFile(thumbnailFilename, thumbnail.buffer);
            }

            // create a pinkenail from the preview
            if ( configuration.preferences.createIndexFiles ) {
                // Same as above Note! about locked previewFilename
                pinkieNail = await thumbnailService.generatePreview(destinationPath/* previewFilename */, { size: 80, quality: 60});
            }

        } else {

            // Try to extract from the file with exiftool
            if ( !metadataFailure ) {

                const { success, thumbnail, preview } = await metadataService.extractThumbnailAndPreview(file.path);

                if ( success && preview ) {
                    const previewFilename = thumbnailService.generatePreviewFilename(destinationPath);
                    fs.copyFileSync(preview, previewFilename);

                    if ( !pinkieNail && configuration.preferences.createIndexFiles ) {
                        pinkieNail = await thumbnailService.generatePreview(preview, { size: 80, quality: 60});
                    }

                    fs.unlinkSync(preview);
                }

                if ( success && thumbnail ) {
                    const thumbnailFilename = thumbnailService.generateThumbnailFilename(destinationPath);
                    fs.copyFileSync(thumbnail, thumbnailFilename);

                    if ( !pinkieNail && configuration.preferences.createIndexFiles ) {
                        pinkieNail = await thumbnailService.generatePreview(thumbnail, { size: 80, quality: 60});
                    }

                    fs.unlinkSync(thumbnail);
                }

                if ( success && preview && !thumbnail ) {
                    // create the thumbnail from the preview
                    const options = {
                        size: configuration.preferences.thumbnailSize,
                        quality: configuration.preferences.thumbnailQuality
                    };
                    const thumbnail = await thumbnailService.generatePreview(preview.buffer, options);
                    if ( thumbnail.success ) {
                        const thumbnailFilename = thumbnailService.generateThumbnailFilename(destinationPath);
                        await fs.promises.writeFile(thumbnailFilename, thumbnail.buffer);
                    }
                }
            }
        
        }
    }


    /*  
     *  Append to the index file
     *  
    */

    if ( configuration.preferences.createIndexFiles ) {

        logger.info(`Writing record to index file ${destinationPath}`);

        const indexFilename = "ztindex.jsonl";
        const indexPath = path.join(destinationFolder, indexFilename);

        const record = {
            name: path.basename(destinationPath),
            path: destinationPath.substring(destinationFolder.length + 1),
            size: file.size,
            date: file.created.toISOString(),
            capture_date: fileDateToUse.toISOString(),
            hash: sourceHash,
            type: mimeTypeService.getMimeType(file.path),
            extension: path.extname(file.path),
            thumbnail: pinkieNail ? pinkieNail.buffer.toString('base64') : null,
            width: readMetadata ? readMetadata.metadata.ImageWidth : null,
            height: readMetadata ? readMetadata.metadata.ImageHeight : null,
            orientation: readMetadata ? readMetadata.metadata.Orientation : null,
            latitude: readMetadata ? readMetadata.metadata.GPSLatitude : null,
            longitude: readMetadata ? readMetadata.metadata.GPSLongitude : null,
            altitude: readMetadata ? readMetadata.metadata.GPSAltitude : null,
            camera: readMetadata ? readMetadata.metadata.CameraModelName : null,
            lens: readMetadata ? (
                readMetadata.metadata.LensModel ||
                readMetadata.metadata.Lens ||
                readMetadata.metadata.LensSpecification ||
                readMetadata.metadata.LensInfo ||
                null
            ) : null,
            lens_make: readMetadata ? (
                readMetadata.metadata.LensMake ||
                null
            ) : null,
            focal_length: readMetadata ? (
                readMetadata.metadata.FocalLength ||
                null
            ) : null,
            focal_length_35mm: readMetadata ? (
                readMetadata.metadata.FocalLengthIn35mmFormat ||
                null
            ) : null,
            aperture: readMetadata ? (
                readMetadata.metadata.FNumber ||
                readMetadata.metadata.ApertureValue ||
                null
            ) : null,
            shutter_speed: readMetadata ? (
                readMetadata.metadata.ExposureTime ||
                readMetadata.metadata.ShutterSpeedValue ||
                null
            ) : null,
            iso: readMetadata ? (
                readMetadata.metadata.ISO ||
                null
            ) : null,
            exposure_compensation: readMetadata ? (
                readMetadata.metadata.ExposureCompensation ||
                null
            ) : null,
            flash: readMetadata ? (
                readMetadata.metadata.Flash ||
                null
            ) : null,
            white_balance: readMetadata ? (
                readMetadata.metadata.WhiteBalance ||
                null
            ) : null,
            metering_mode: readMetadata ? (
                readMetadata.metadata.MeteringMode ||
                null
            ) : null,
        }
        
        const stream = fs.createWriteStream(indexPath, { flags: 'a' });
        stream.write(JSON.stringify(record).replaceAll('\n','\\n') + '\n'); // Each object on a new line
        stream.end();
    } else {
        logger.debug(`Index file not created because createIndexFiles is disabled`);
    }


    /*  
     *  Submit to the queue for upload services to handl3
     *  
    */

    
    for ( const service of settings.enabledServices ) {
        console.log("!!!", service);
         /*addFiles(files) {
            if (!this.isInitialized) throw new Error('Queue manager not initialized');
            
            const transaction = this.db.transaction((files) => {
                const results = [];
    
                for (const file of files) {
                    try {
                       
                            source_path,
                            remote_path,
                            file_size,
                            file_date,
                            mime_type,
                            service_type
                        */
    }




    // Return the result to mother

    return { 
        operation: 'completed',
        destinationPath: destinationPath
    };
}

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