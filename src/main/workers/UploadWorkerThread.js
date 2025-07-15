const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const logger = require('./WorkerLogger.js');

// Let the world know we're here
const { workerId } = workerData;
logger.info(`Upload worker ${workerId} started`);

// Stuff we need
const { MimeTypesService } = require('../services/MimeTypesService.js');
const { getFolderName, formatDateForFolder, generateRemoteName } = require('../services/FileNamePathCreator.js');

// The upload services we'll use
const { ZenTransferService } = require('./clouds/ZenTransferService.js');
const { AWSService } = require('./clouds/AWSService.js');
const { AzureService } = require('./clouds/AzureService.js');
const { GoogleService } = require('./clouds/GoogleService.js');
const { MinioService } = require('./clouds/MinioService.js');

// Message handling
parentPort.on('message', async ({ uploadRequest }) => {
  try {
    let result;
    
    switch (type) {
      case 'upload-file':
        result = await uploadFile(uploadRequest);
        break;
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
    
    parentPort.postMessage({
      type: 'result',
      jobId,
      result
    });
    
  } catch (error) {
    console.error(`Worker ${workerId} job ${jobId} failed:`, error);
    
    parentPort.postMessage({
      type: 'error',
      jobId,
      error: error.message
    });
  }
});

// Upload a single file using the specified service
async function uploadFile(uploadRequest) {
  logger.warn('UploadFile not implemented, received request:', uploadRequest);
  throw new Error('UploadFile not implemented');
}

async function uploadFile2(uploadRequest) {
  const { fileId, fileName, fileSize, fileType, fileBuffer, serviceType, serviceName, importSettings } = fileData;
  const { session, token, serverBaseUrl, appName, appVersion, clientId, servicePreferences, selectedService } = sessionData;
  
  try {
    // Check for cancellation
    if (cancelledJobs.has(jobId)) {
      throw new Error('Upload cancelled by user');
    }
    
    // Send initial progress
    sendProgress(fileId, 0, 'Initializing upload...');
    
    // Determine correct MIME type from file extension
    const correctMimeType = getMimeTypeFromExtension(fileName);
    logger.info(`Upload Worker ${workerId}: File ${fileName} - Browser type: ${fileType}, Detected type: ${correctMimeType}`);
    
    // Determine which service to use based on file's service type or selected service
    const targetService = serviceType || selectedService || 'zentransfer';
    const targetServiceName = serviceName || 'ZenTransfer';
    let uploadService;
    let actualServiceName;
    
    if (targetService === 'aws-s3') {
        // Use AWS S3 service
        actualServiceName = 'AWS S3';
        
        if (!awsS3Service) {
            // Validate S3 configuration
            if (!servicePreferences.awsS3Region || !servicePreferences.awsS3Bucket || 
                !servicePreferences.awsS3AccessKey || !servicePreferences.awsS3SecretKey) {
                throw new Error('Incomplete AWS S3 configuration. Please check your S3 settings.');
            }
            
            awsS3Service = new AwsS3Service({
                region: servicePreferences.awsS3Region,
                bucket: servicePreferences.awsS3Bucket,
                accessKey: servicePreferences.awsS3AccessKey,
                secretKey: servicePreferences.awsS3SecretKey,
                storageClass: servicePreferences.awsS3StorageTier || 'STANDARD'
            });
        }
        
        uploadService = awsS3Service;
        
    } else if (targetService === 'azure-blob') {
        // Use Azure Blob Storage service
        actualServiceName = 'Azure Blob Storage';
        
        if (!azureBlobService) {
            // Validate Azure configuration
            if (!servicePreferences.azureConnectionString || !servicePreferences.azureContainer) {
                throw new Error('Incomplete Azure Blob Storage configuration. Please check your Azure settings.');
            }
            
            azureBlobService = new AzureBlobService({
                connectionString: servicePreferences.azureConnectionString,
                containerName: servicePreferences.azureContainer
            });
        }
        
        uploadService = azureBlobService;
        
    } else if (targetService === 'gcp-storage') {
        // Use GCP Cloud Storage service
        actualServiceName = 'GCP Cloud Storage';
        
        if (!gcpStorageService) {
            // Validate GCP configuration
            if (!servicePreferences.gcpBucket || !servicePreferences.gcpServiceAccountKey) {
                throw new Error('Incomplete GCP Cloud Storage configuration. Please check your GCP settings.');
            }
            
            gcpStorageService = new GcpStorageService({
                bucketName: servicePreferences.gcpBucket,
                serviceAccountKey: servicePreferences.gcpServiceAccountKey
            });
        }
        
        uploadService = gcpStorageService;
        
    } else if (targetService === 'minio') {
        // Use MinIO service
        actualServiceName = 'MinIO';
        
        logger.info(`[Upload Worker] Processing MinIO upload for file: ${fileName}`);
        logger.info(`[Upload Worker] MinIO service preferences:`, {
            endpoint: servicePreferences.minioEndpoint,
            bucket: servicePreferences.minioBucket,
            port: servicePreferences.minioPort,
            useSSL: servicePreferences.minioUseSSL,
            region: servicePreferences.minioRegion,
            hasAccessKey: !!servicePreferences.minioAccessKey,
            hasSecretKey: !!servicePreferences.minioSecretKey
        });
        
        if (!minioService) {
            // Validate MinIO configuration
            if (!servicePreferences.minioEndpoint || !servicePreferences.minioBucket || 
                !servicePreferences.minioAccessKey || !servicePreferences.minioSecretKey) {
                throw new Error('Incomplete MinIO configuration. Please check your MinIO settings.');
            }
            
            logger.info(`[Upload Worker] Creating new MinIO service instance`);
            minioService = new MinioService({
                endpoint: servicePreferences.minioEndpoint,
                port: servicePreferences.minioPort || 9000,
                useSSL: servicePreferences.minioUseSSL !== false,
                bucket: servicePreferences.minioBucket,
                region: servicePreferences.minioRegion || 'us-east-1',
                accessKey: servicePreferences.minioAccessKey,
                secretKey: servicePreferences.minioSecretKey
            });
        } else {
            logger.info(`[Upload Worker] Reusing existing MinIO service instance`);
        }
        
        uploadService = minioService;
        
    } else {
        // Use ZenTransfer service (default)
        actualServiceName = 'ZenTransfer';
        
        if (!zenTransferService) {
            // Use session data from the current request
            if (!serverBaseUrl || !token || !appName || !appVersion || !clientId) {
                throw new Error('Incomplete session configuration. Missing required parameters.');
            }
            
            zenTransferService = new ZenTransferService({
                apiBaseUrl: serverBaseUrl,
                token: token,
                appName: appName,
                appVersion: appVersion,
                clientId: clientId
            });
            
            // Set the current session if available
            if (session) {
                zenTransferService.currentSession = session;
            }
        }
        
        uploadService = zenTransferService;
    }
    
    logger.info(`Worker ${workerId}: Using ${actualServiceName} for upload of ${fileName}`);
    
    const fs = require('fs');
    const os = require('os');
    let tempFilePath;
    let isTemporary = false;
    
    logger.info('=== UPLOAD WORKER: FILE HANDLING ===');
    logger.info(`Worker ${workerId}: Processing file upload for: ${fileName}`);
    logger.info(`Worker ${workerId}: File data details:`, {
        hasFilePath: !!(fileData.filePath),
        hasFileBuffer: !!(fileBuffer),
        filePath: fileData.filePath || '(none)',
        fileBufferSize: fileBuffer ? fileBuffer.length : 0,
        fileName: fileName,
        fileSize: fileData.size,
        mimeType: correctMimeType,
        source: fileData.source || 'unknown'
    });
    
    try {
      if (fileData.filePath) {
        // Local file - use the path directly (no copying needed)
        tempFilePath = fileData.filePath;
        logger.info(`Worker ${workerId}: ✓ Using local file path directly (NO TEMPORARY FILE NEEDED)`);
        logger.info(`Worker ${workerId}: Local file path: ${tempFilePath}`);
        logger.info(`Worker ${workerId}: Source: ${fileData.source || 'unknown'}`);
        
        if (fileData.source === 'drag-drop-with-path') {
          logger.info(`Worker ${workerId}: 🎉 DRAG/DROP OPTIMIZATION: Using direct path instead of temporary file!`);
          logger.info(`Worker ${workerId}: This drag/drop file is processed as efficiently as import files`);
        }
        
        logger.info(`Worker ${workerId}: Benefits: No copying, no temporary files, direct file access`);
      } else if (fileBuffer) {
        // Web file or file object - create temporary file
        tempFilePath = path.join(os.tmpdir(), `zentransfer_${Date.now()}_${fileName}`);
        logger.info(`Worker ${workerId}: ⚠️ Creating temporary file (FILE OBJECT WITHOUT PATH)`);
        logger.info(`Worker ${workerId}: Source: ${fileData.source || 'unknown'}`);
        logger.info(`Worker ${workerId}: Temporary file path: ${tempFilePath}`);
        logger.info(`Worker ${workerId}: Writing ${fileBuffer.length} bytes to temporary file...`);
        
        if (fileData.source === 'drag-drop-buffer') {
          logger.info(`Worker ${workerId}: This drag/drop file had no path property, using fallback buffer strategy`);
        }
        
        const startTime = Date.now();
        fs.writeFileSync(tempFilePath, fileBuffer);
        const writeTime = Date.now() - startTime;
        
        isTemporary = true;
        logger.info(`Worker ${workerId}: ✓ Temporary file created successfully in ${writeTime}ms`);
        logger.info(`Worker ${workerId}: This requires extra I/O - file is copied from memory to disk`);
      } else {
        throw new Error('No file path or file buffer provided');
      }
      
      logger.info(`Worker ${workerId}: Final file path for upload: ${tempFilePath}`);
      logger.info(`Worker ${workerId}: Is temporary file: ${isTemporary}`);
      logger.info(`Worker ${workerId}: Processing efficiency: ${isTemporary ? 'LESS EFFICIENT (temp file)' : 'HIGHLY EFFICIENT (direct path)'}`);
      
      // Generate remote name with folder organization if needed
      //remoteName = generateRemoteName(fileData.filePath, importSettings);
      let remoteName = fileName;
      if (importSettings.destinationPath && importSettings.destinationPath.length > 0)
        remoteName = fileData.filePath.substr(importSettings.destinationPath.length+1).replaceAll('\\', '/');
      
      // Extract skipDuplicates setting from importSettings
      const skipDuplicates = importSettings ? importSettings.skipDuplicates : false;
      
      // Set up progress monitoring
      const originalUpdateProgress = uploadService._updateProgress;
      uploadService._updateProgress = (uploadId, progress, status) => {
        // Check for cancellation during upload
        if (cancelledJobs.has(jobId)) {
          throw new Error('Upload cancelled by user');
        }
        
        sendProgress(fileId, progress, status);
        
        // Call original method
        if (originalUpdateProgress) {
          originalUpdateProgress.call(uploadService, uploadId, progress, status);
        }
      };
      
      // Call upload service
      const uploadResult = await uploadService.uploadFile(
        tempFilePath, 
        remoteName, 
        correctMimeType,
        { 
          metadata: { 
            originalName: fileName, 
            uploadedBy: clientId,
            appName,
            appVersion
          },
          skipDuplicates: skipDuplicates, // Pass skipDuplicates setting to service
          metadataOptions: {
            createPreviews: servicePreferences.createPreviews || false,
            extractMetadata: servicePreferences.extractMetadata || false,
            thumbnailSize: servicePreferences.thumbnailSize || 400,
            thumbnailQuality: servicePreferences.thumbnailQuality || 90,
            previewSize: servicePreferences.previewSize || 1920,
            previewQuality: servicePreferences.previewQuality || 90
          }
        }
      );
      // Restore original progress method
      uploadService._updateProgress = originalUpdateProgress;
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.message);
      }
      
      sendProgress(fileId, 100, 'Upload completed');
      
      // Extract upload ID based on service type
      let extractedUploadId;
      if (targetService === 'zentransfer') {
        extractedUploadId = uploadResult.details?.zentransferUploadId;
      } else {
        // For other services (AWS S3, Azure, GCP, MinIO), use the generic uploadId
        extractedUploadId = uploadResult.details?.uploadId;
      }
      
      return {
        fileId,
        status: 'completed',
        uploadId: extractedUploadId,
        finalUrl: uploadResult.url
      };
      
    } finally {
      // Clean up temporary file only if we created it
      logger.info(`Worker ${workerId}: === CLEANUP PHASE ===`);
      logger.info(`Worker ${workerId}: Is temporary file: ${isTemporary}`);
      logger.info(`Worker ${workerId}: File path: ${tempFilePath}`);
      
      if (isTemporary) {
        try {
          if (fs.existsSync(tempFilePath)) {
            logger.info(`Worker ${workerId}: 🗑️ Removing temporary file: ${tempFilePath}`);
            const statsBefore = fs.statSync(tempFilePath);
            logger.info(`Worker ${workerId}: Temporary file size: ${statsBefore.size} bytes`);
            
            fs.unlinkSync(tempFilePath);
            logger.info(`Worker ${workerId}: ✓ Temporary file successfully removed`);
            logger.info(`Worker ${workerId}: This frees up ${statsBefore.size} bytes of disk space`);
          } else {
            logger.info(`Worker ${workerId}: Temporary file no longer exists: ${tempFilePath}`);
          }
        } catch (cleanupError) {
          console.warn(`Worker ${workerId}: ❌ Failed to clean up temp file: ${cleanupError.message}`);
        }
      } else {
        logger.info(`Worker ${workerId}: ✓ Skipping cleanup for local file (no temporary file created)`);
        logger.info(`Worker ${workerId}: Local file remains at: ${tempFilePath}`);
      }
      
      logger.info(`Worker ${workerId}: === END CLEANUP ===`);
    }
    
  } catch (error) {
    sendProgress(fileId, 0, `Upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Send progress update to main process
 */
function sendProgress(fileId, progress, status) {
  parentPort.postMessage({
    type: 'progress',
    fileId,
    progress,
    status
  });
}

// Handle worker shutdown
process.on('SIGTERM', () => {
  logger.info(`Upload worker ${workerId} shutting down`);
  process.exit(0);
});

