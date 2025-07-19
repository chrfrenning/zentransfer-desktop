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
const { CloudFactory } = require('../services/CloudFactory.js');
const { DateFormatter } = require('../utils/DateFormatter.js');

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

  const { type, fileRecord, configuration, globals } = message;

  //console.log("Received configuration:", configuration);
  //console.log("XX-UploadSession:", configuration.uploadSession);

  const configurationData = new ConfigurationData();
  configurationData.fromConfig(configuration);

  //console.log("ConfigurationData:", configurationData);

  try {

    switch (type) {

      case 'upload-file':
        console.log(`Uploading file: ${fileRecord.file_name}`);
        const result = await uploadFile(fileRecord, configurationData, globals, configuration.uploadSession);

        if ( result.success ) {

          parentPort.postMessage({ 
            type: 'completed', 
            fileRecord: { 
              ...fileRecord, 
              status: 'completed',  
              final_url: result.url
            } 
          });

        } else {

          parentPort.postMessage({ 
            type: 'completed', 
            fileRecord: { 
              ...fileRecord, 
              status: 'failed',  
              error_message: result.message
            } 
          });

        }

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
async function uploadFile(fileRecord, configurationData, globals, uploadSession) {

  try {

    return await uploadFile2(fileRecord, configurationData, globals, uploadSession);

  } catch (error) {

    logger.error(`Worker failed in uploadFile2: ${error.message}`);
    return {
      success: false,
      message: error.message
    }

  }
}

// Just to keep indentation free of those long try-catch blocks
async function uploadFile2(fileRecord, configurationData, globals, uploadSession) {
  const { id, source_path, file_name, file_size, file_date, mime_type, service_type } = fileRecord;


  // Send initial progress
  let bytes_transferred = 0;
  fileRecord.status = 'uploading';
  sendUploadTransferProgress(fileRecord, bytes_transferred);


  // Determine which service to use based on file's service type or selected service
  console.log("UploadSession:", uploadSession);
  const svcConfiguration = configurationData.getCloudService(service_type) || {};
  svcConfiguration.session = uploadSession;
  console.log("svcConfiguration", JSON.stringify(svcConfiguration));
  const cloudService = CloudFactory.getCloudService(service_type, svcConfiguration);
  logger.info(`Using ${cloudService.getServiceName()} for upload of ${file_name}`);


  // Set up progress monitoring
  cloudService.on('progress', (progress) => {
    console.log('--- Progress received:', progress);
    const bytesTransferred = progress.bytesTransferred;
    sendUploadTransferProgress(fileRecord, bytesTransferred);
  });


  // Call upload service
  // filePath, remoteName, mimeType, options
  const uploadResult = await cloudService.uploadFile(
    source_path,
    file_name,
    mime_type,
    {
      metadata: {
        originalName: path.basename(source_path),
        uploadedBy: globals.clientId,
        appName: globals.appName,
        appVersion: globals.appVersion
      },
      processingOptions: {
        createPreviews: true,
        extractMetadata: true
      },
      configurationData,
      globals,
      session : uploadSession
    }
  );

  if (!uploadResult.success) {
    throw new Error(uploadResult.message);
  }

  // We're done, return the url to the object

  return {
    success: true,
    url: uploadResult.url
  };


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
