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
const https = require('https');
const { URL } = require('url');

const sharp = require('sharp');
sharp.cache(false);

const exifOrientationToDegrees = {
    1: 0,    // Normal
    2: 0,    // Mirrored horizontally
    3: 180,  // Rotated 180°
    4: 180,  // Mirrored vertically
    5: 90,   // Mirrored horizontally, then rotated 90° CCW
    6: 90,   // Rotated 90° CW
    7: -90,  // Mirrored horizontally, then rotated 90° CW
    8: -90   // Rotated 90° CCW
  };

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
const CREATE_ALTERNATIVE_IX_FORMATS = true;
const CREATE_THUMBNAIL_FROM_HIGHRES = false;
const ALWAYS_THUMB_FROM_PREVIEW = true;

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

    // This is the mother of all functions. Good luck reading it!
    
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

    if ( settings.organizeIntoFolders == 'date' && settings.dateFormat ) {
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
                const { success, metadata : extractedMetadata } = await metadataService.extractMetadata(destinationPath);
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

        const preview = await thumbnailService.generatePreview(destinationPath, options);
        if ( preview.success ) {

            logger.verbose(`Successfully created preview from ${destinationPath}.`)
            
            const previewFilename = thumbnailService.generatePreviewFilename(destinationPath);
            await fs.promises.writeFile(previewFilename, preview.buffer);
            logger.debug(`Preview saved in ${previewFilename}.`)

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

                const thumbnailSource = CREATE_THUMBNAIL_FROM_HIGHRES ? destinationPath : previewFilename;

                const thumbnailFilename = thumbnailService.generateThumbnailFilename(destinationPath);
                await fs.promises.writeFile(thumbnailFilename, thumbnail.buffer);

                logger.debug(`Created thumbnail from ${thumbnailSource} saved in ${previewFilename}.`);
            }

            // create a pinkenail from the preview
            if ( configuration.preferences.createIndexFiles ) {
                // Same as above Note! about locked previewFilename
                pinkieNail = await thumbnailService.generatePreview(CREATE_THUMBNAIL_FROM_HIGHRES ? destinationPath : previewFilename, { size: 80, quality: 60});
            }

        } else {

            // Try to extract from the file with exiftool
            if ( !metadataFailure ) {

                const { success, thumbnail, preview } = await metadataService.extractThumbnailAndPreview(CREATE_THUMBNAIL_FROM_HIGHRES ? destinationPath : file.path);

                if ( success && preview ) {
                    const previewFilename = thumbnailService.generatePreviewFilename(destinationPath);

                    let mustProcess = false;
                    const { eWidth, eHeight } = await getImageDimensions(preview);
                    logger.debug(`Dimensions of ${file.path} is ${eWidth}x${eHeight} px.`);
                    if ( eWidth > configuration.preferences.previewSize || eHeight > configuration.preferences.previewSize ) {
                        logger.debug(`Preview dimensions are larger than ${configuration.preferences.previewSize}, must process.`);
                        mustProcess = true;
                    }

                    // This preview may not be rotated
                    if ( readMetadata && readMetadata.metadata.Orientation ) {
                        const rotation = exifOrientationToDegrees[readMetadata.metadata.Orientation] || 0;
                        if ( rotation != 0 ) {
                            logger.debug(`Rotation of ${rotation}def for ${file.path}, must process.`);
                            mustProcess = true;
                        }
                    }

                    if ( mustProcess ) {
                        const rotation = exifOrientationToDegrees[readMetadata.metadata.Orientation] || 0;
                        try {

                            const image = sharp(preview);
                            const rotated = await image.resize(
                                configuration.preferences.previewSize, 
                                configuration.preferences.previewSize, 
                                {
                                    fit: 'inside', // Fit within, preserving aspect ratio
                                    withoutEnlargement: true // Do not upscale smaller images
                                }
                              )
                              .rotate(rotation)
                              .webp({ quality: configuration.preferences.previewQuality })
                              .toBuffer();

                            await fs.promises.writeFile(previewFilename, rotated);


                            if ( ALWAYS_THUMB_FROM_PREVIEW ) {

                                const thumbnailFilename = thumbnailService.generateThumbnailFilename(destinationPath);

                                const thumbnail = await image.resize(
                                    configuration.preferences.thumbnailSize, 
                                    configuration.preferences.thumbnailSize, 
                                    {
                                        fit: 'inside', // Fit within, preserving aspect ratio
                                        withoutEnlargement: true // Do not upscale smaller images
                                    }
                                  )
                                  //.rotate(rotation)
                                  .webp({ quality: configuration.preferences.thumbnailQuality })
                                  .toBuffer();

                                await fs.promises.writeFile(thumbnailFilename, thumbnail);
                            }

                            image.destroy();

                        } catch (error ) {

                            // Note: Same as below
                            fs.copyFileSync(preview, previewFilename);
                            
                        }
                    } else {

                        fs.copyFileSync(preview, previewFilename);

                    }

                    const thumbnailFilename = thumbnailService.generateThumbnailFilename(destinationPath);
                    if ( ALWAYS_THUMB_FROM_PREVIEW && !fs.existsSync(thumbnailFilename) ) {
                        const thumbnail = await thumbnailService.generatePreview(
                            previewFilename, 
                            { 
                                size: configuration.preferences.thumbnailSize, 
                                quality: configuration.preferences.thumbnailQuality
                            }
                        );
                        await fs.promises.writeFile(thumbnailFilename, thumbnail.buffer);
                    }

                    if ( !pinkieNail && configuration.preferences.createIndexFiles ) {
                        pinkieNail = await thumbnailService.generatePreview(previewFilename, { size: 80, quality: 60});
                    }
                }

                if ( success && thumbnail && !ALWAYS_THUMB_FROM_PREVIEW ) {
                    const thumbnailFilename = thumbnailService.generateThumbnailFilename(destinationPath);
                    
                    // This thumbnail may not be rotated
                    if ( readMetadata && readMetadata.metadata.Orientation ) {

                        const rotation = exifOrientationToDegrees[readMetadata.metadata.Orientation] || 0;

                        if ( rotation != 0 ) {

                            const rotation = readMetadata.metadata.Orientation == 6 ? 90 : -90;
                            
                            try {

                                const image = sharp(thumbnail);
                                const rotated = await image.rotate(rotation).toBuffer();
                                await fs.promises.writeFile(thumbnailFilename, rotated);
                                image.destroy();

                            } catch ( error ) {

                                // Note: same as below
                                fs.copyFileSync(thumbnail, thumbnailFilename);

                            }

                        } else {

                            // Note: same as below
                            fs.copyFileSync(thumbnail, thumbnailFilename);
                            
                        }

                    } else {

                        fs.copyFileSync(thumbnail, thumbnailFilename);

                    }


                    // If we don't have a preview, take what we have...

                    if (!preview) {

                        logger.warn(`Using thumbnail as fallback for preview for ${file.path}.`);
                        const previewFilename = thumbnailService.generatePreviewFilename(destinationPath);
                        fs.copyFileSync(thumbnailFilename, previewFilename);

                    }

                    // Create the pinkienail if we dont alrady have one

                    if ( !pinkieNail && configuration.preferences.createIndexFiles ) {
                        pinkieNail = await thumbnailService.generatePreview(thumbnailFilename, { size: 80, quality: 60});
                    }


                    // Clean up the thumb, we're good

                    try {
                        fs.unlinkSync(thumbnail);
                    } catch ( error ) {
                        console.log(`Unable to delete tmp thumbnail file: ${preview}`);
                    }
                }

                if ( success && preview && !thumbnail && !ALWAYS_THUMB_FROM_PREVIEW ) {
                    // create the thumbnail from the preview
                    const options = {
                        size: configuration.preferences.thumbnailSize,
                        quality: configuration.preferences.thumbnailQuality
                    };
                    const previewFileNameToUse = thumbnailService.generatePreviewFilename(destinationPath);
                    const thumbnail = await thumbnailService.generatePreview(previewFileNameToUse, options);
                    if ( thumbnail.success ) {
                        const thumbnailFilename = thumbnailService.generateThumbnailFilename(destinationPath);
                        await fs.promises.writeFile(thumbnailFilename, thumbnail.buffer);
                    }
                }

                try {
                    fs.unlinkSync(preview);
                } catch ( error ) {
                    console.log(`Unable to delete tmp preview file: ${preview}`);
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

        let imageWidth = readMetadata ? readMetadata.metadata.ImageWidth : null;
        let imageHeight = readMetadata ? readMetadata.metadata.ImageHeight : null;

        if ( imageWidth && imageHeight && readMetadata.metadata.Orientation ) {
            const rotation = exifOrientationToDegrees[readMetadata.metadata.Orientation] || 0;
            if ( rotation == 90 || rotation == -90 ) {
                const t = imageWidth;
                imageWidth = imageHeight;
                imageHeight = t;
            }
        }

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
            width: imageWidth,
            height: imageHeight,
            orientation: imageWidth && imageHeight ? classifyDimensions(imageWidth, imageHeight) : null,
            latitude: readMetadata ? readMetadata.metadata.GPSLatitude : null,
            longitude: readMetadata ? readMetadata.metadata.GPSLongitude : null,
            altitude: readMetadata ? readMetadata.metadata.GPSAltitude : null,
            camera_make: readMetadata ? (
                readMetadata.metadata.CameraMake ||
                readMetadata.metadata.Make ||
                null
            ) : null,
            camera_model: readMetadata ? (
                readMetadata.metadata.CameraModel ||
                readMetadata.metadata.Model ||
                readMetadata.metadata.CameraModelName ||
                null
            ) : null,
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

        stream.on('finish', () => {
            if ( CREATE_ALTERNATIVE_IX_FORMATS ) {
                createAlternativeIndexFormats(indexPath);
            }
        });

        const portfolioIndexFileName = path.join(destinationFolder, 'index.html');
        const portfolioStylesheetFileName = path.join(destinationFolder, 'index.css');
        const portfolioScriptFileName = path.join(destinationFolder, 'index.js');
        await downloadFile('https://ztapp.blob.core.windows.net/browser/index.html', portfolioIndexFileName);
        await downloadFile('https://ztapp.blob.core.windows.net/browser/index.css', portfolioStylesheetFileName);
        await downloadFile('https://ztapp.blob.core.windows.net/browser/index.js', portfolioScriptFileName);
        
    } else {
        logger.debug(`Index file not created because createIndexFiles is disabled`);
    }


    /*  
     *  Submit to the queue for upload services to handl3
     *  
    */

    
    for ( const service of settings.enabledServices ) {
        
        /* this.uploadQueue.addFiles([{
            source_path: destinationPath,
            remote_path: destinationPath.substring(destinationFolder.length + 1),
            file_size: file.size,
            file_date: file.created,
            mime_type: mimeTypeService.getMimeType(file.path),
            service_type: service
        }]); */

        logger.debug(`Posting ${destinationPath} to upload queue for ${service}.`)

        sendMessageToParent(
            'post-to-upload',
            { 
                filename: destinationPath,
                service: service
            }
        );

    }




    // Return the result to mother

    logger.info(`Successfully completed processing of ${file.path} -> ${destinationPath}.`)

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

function classifyDimensions(width, height) {
    if (!width || !height) return null;

    // Tolerance to account for small metadata rounding errors
    const tolerance = 0.05;
    const aspectRatio = width / height;

    if (Math.abs(aspectRatio - 1) <= tolerance) {
        return "square";
    } else if (aspectRatio >= 2) {
        return "panorama"; // Very wide
    } else if (aspectRatio <= 0.5) {
        return "banner"; // Very tall (vertical panorama)
    } else if (width > height) {
        return "landscape";
    } else {
        return "portrait";
    }
}

async function createAlternativeIndexFormats(inputFilePath) {

    console.log(`Converting jsonl file ${inputFilePath}`);

    const baseName = path.basename(inputFilePath, path.extname(inputFilePath));
    const dirName = path.dirname(inputFilePath);

    const jsonOutputPath = path.join(dirName, `${baseName}.json`);
    const csvOutputPath = path.join(dirName, `${baseName}.csv`);

    const lines = fs.readFileSync(inputFilePath, 'utf8')
        .split(/\r?\n/)
        .filter(line => line.trim() !== '');

    // Parse all lines into JSON objects
    const objects = lines.map(line => JSON.parse(line));

    // Write JSON array
    fs.writeFileSync(jsonOutputPath, JSON.stringify(objects, null, 2), 'utf8');

    // Prepare CSV
    const headers = Object.keys(objects[0]);
    const csvLines = [headers.map(h => `"${h}"`).join(',')];

    for (const obj of objects) {
        const row = headers.map(h => {
            const val = obj[h] !== undefined ? String(obj[h]).replace(/"/g, '""') : '';
            return `"${val}"`;
        }).join(',');
        csvLines.push(row);
    }

    fs.writeFileSync(csvOutputPath, csvLines.join('\n'), 'utf8');

    console.log(`Converted to: \n - ${jsonOutputPath}\n - ${csvOutputPath}`);
}

async function getImageDimensions(filePath) {
    const metadata = await sharp(filePath).metadata();
    return {
        width: metadata.width,
        height: metadata.height
    };
}

function downloadFile(fileUrl, destPath) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(fileUrl);
      const protocol = urlObj.protocol === 'https:' ? https : http;
  
      const file = fs.createWriteStream(destPath);
  
      const request = protocol.get(fileUrl, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // Handle redirects
          return downloadFile(response.headers.location, destPath)
            .then(resolve)
            .catch(reject);
        }
  
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to get '${fileUrl}' (status: ${response.statusCode})`));
        }
  
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      });
  
      request.on('error', err => {
        fs.unlink(destPath, () => reject(err)); // Delete partial file on error
      });
  
      file.on('error', err => {
        fs.unlink(destPath, () => reject(err));
      });
    });
  }