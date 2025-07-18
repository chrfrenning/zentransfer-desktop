const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('./WorkerLogger.js');

// Let the world know we're here
const { workerId } = workerData;
logger.info(`Upload worker ${workerId} started`);

// Configuration
const { ConfigurationData } = require('../configuration/ConfigurationData.js');

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
parentPort.on('message', async (message) => {

  const { type, fileRecord, configuration } = message;
  const configurationData = new ConfigurationData();
  configurationData.fromConfig(configuration);

  try {

    switch (type) {

      case 'upload-file':
        console.log(`Uploading file: ${fileRecord.file_name}`);
        const result = await uploadFile(fileRecord, configurationData);
        parentPort.postMessage({ type: 'completed', fileRecord: fileRecord });
        break;

      default:
        logger.error("Unknown message type:", type);

    }
    
  } catch (error) {

    console.error(`Worker ${workerId} failed with type and file:`, type, fileRecord);
    throw error;

  }
});

// Upload a single file using the specified service
async function uploadFile(fileRecord, configurationData) {
  const { id, source_path, file_name, file_size, file_date, mime_type, service_type } = fileRecord;
  
  try {

    // Send initial progress
    let bytes_transferred = 0;
    fileRecord.status = 'uploading';
    sendUploadTransferProgress(fileRecord, bytes_transferred);
    
    // Determine which service to use based on file's service type or selected service
    const cloudService = CloudFactory.getCloudService(targetService, configurationData.getCloudService(fileRecord.service_type));
    logger.info(`Worker ${workerId}: Using ${cloudService.getServiceName()} for upload of ${fileName}`);
    
   // Generate remote name with folder organization if needed
   //remoteName = generateRemoteName(fileData.filePath, importSettings);
   let remoteName = file_name.replaceAll('\\', '/');
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

function sendUploadTransferProgress(fileRecord, bytesTransferred) {

  const amendedFileRecord = { ...fileRecord, bytes_transferred: bytesTransferred };

  parentPort.postMessage({
    type: 'progress',
    fileRecord: amendedFileRecord
  });

}

// Handle worker shutdown
process.on('SIGTERM', () => {
  logger.info(`Upload worker ${workerId} shutting down`);
  process.exit(0);
});
