const { parentPort, workerData } = require('worker_threads');
const path = require('path');

const { workerId } = workerData;

console.log(`Upload worker ${workerId} started`);

// Import upload services
const { ZenTransferService } = require(path.join(__dirname, 'services', 'zentransfer-service.js'));
const { AwsS3Service } = require(path.join(__dirname, 'services', 'aws-s3-service.js'));
const { AzureBlobService } = require(path.join(__dirname, 'services', 'azure-blob-service.js'));
const { GcpStorageService } = require(path.join(__dirname, 'services', 'gcp-storage-service.js'));

// Worker state
let zenTransferService = null;
let awsS3Service = null;
let azureBlobService = null;
let gcpStorageService = null;
let cancelledJobs = new Set();
let storedSessionConfig = null; // Store the full session configuration

// Get MIME type from file extension
function getMimeTypeFromExtension(fileName) {
  const fs = require('fs');
  
  try {
    const mimeTypesPath = path.join(__dirname, 'mime.types');
    
    // Check if file exists
    if (!fs.existsSync(mimeTypesPath)) {
      console.warn(`Worker ${workerId}: MIME types file does not exist, using default`);
      return getDefaultMimeType(fileName);
    }
    
    const content = fs.readFileSync(mimeTypesPath, 'utf8');
    const ext = path.extname(fileName).toLowerCase().slice(1); // Remove the dot
    
    const lines = content.split('\n');
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || !line.trim()) continue;
      
      // Parse line: "mimetype\t\t\t\text1 ext2 ext3"
      const parts = line.split(/\s+/).filter(part => part.length > 0);
      if (parts.length >= 2) {
        const mimeType = parts[0];
        const extensions = parts.slice(1);
        
        if (extensions.includes(ext)) {
          console.log(`Worker ${workerId}: File: ${fileName}, Extension: ${ext}, MIME type: ${mimeType}`);
          return mimeType;
        }
      }
    }
    
    // Fallback to default
    return getDefaultMimeType(fileName);
    
  } catch (error) {
    console.error(`Worker ${workerId}: Failed to load MIME types:`, error);
    return getDefaultMimeType(fileName);
  }
}

// Get default MIME type based on common extensions
function getDefaultMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const defaultTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.zip': 'application/zip'
  };
  
  return defaultTypes[ext] || 'application/octet-stream';
}

parentPort.on('message', async ({ type, jobId, ...data }) => {
  try {
    if (type === 'cancel') {
      // Mark job as cancelled
      cancelledJobs.add(jobId);
      console.log(`Worker ${workerId}: Job ${jobId} marked for cancellation`);
      return;
    }
    
    let result;
    
    switch (type) {
      case 'upload':
        if (data.type === 'create-session') {
          result = await createUploadSession(data.sessionData);
        } else if (data.type === 'upload-file') {
          result = await uploadFile(data.fileData, data.sessionData, jobId);
        }
        break;
      case 'create-session':
        result = await createUploadSession(data.sessionData);
        break;
      case 'upload-file':
        result = await uploadFile(data.fileData, data.sessionData, jobId);
        break;
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
    
    // Check if job was cancelled before sending result
    if (cancelledJobs.has(jobId)) {
      cancelledJobs.delete(jobId);
      parentPort.postMessage({
        type: 'error',
        jobId,
        error: 'Upload cancelled by user'
      });
      return;
    }
    
    parentPort.postMessage({
      type: 'result',
      jobId,
      result
    });
    
  } catch (error) {
    console.error(`Worker ${workerId} job ${jobId} failed:`, error);
    
    // Clean up cancelled job if it failed
    if (cancelledJobs.has(jobId)) {
      cancelledJobs.delete(jobId);
    }
    
    parentPort.postMessage({
      type: 'error',
      jobId,
      error: error.message
    });
  }
});

/**
 * Create upload session using ZenTransfer service
 */
async function createUploadSession(sessionData) {
  const { serverBaseUrl, token, appName, appVersion, clientId } = sessionData;
  
  // Store the full session configuration for later use
  storedSessionConfig = {
    serverBaseUrl,
    token,
    appName,
    appVersion,
    clientId
  };
  
  // Initialize ZenTransfer service if not already done
  if (!zenTransferService) {
    zenTransferService = new ZenTransferService({
      apiBaseUrl: serverBaseUrl,
      token: token,
      appName: appName,
      appVersion: appVersion,
      clientId: clientId
    });
  } else {
    // Update settings if they've changed
    zenTransferService.updateSettings({
      apiBaseUrl: serverBaseUrl,
      token: token,
      appName: appName,
      appVersion: appVersion,
      clientId: clientId
    });
  }
  
  // Test connection (which creates a session)
  const testResult = await zenTransferService.testConnection();
  
  if (!testResult.success) {
    throw new Error(`Failed to create upload session: ${testResult.message}`);
  }
  
  // Return session data in the format expected by the worker
  return {
    parentId: testResult.details.parentId,
    uploadUrl: zenTransferService.currentSession.uploadUrl,
    expiresAt: zenTransferService.currentSession.expiresAt
  };
}

/**
 * Upload a single file using the specified service
 */
async function uploadFile(fileData, sessionData, jobId) {
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
    console.log(`Upload Worker ${workerId}: File ${fileName} - Browser type: ${fileType}, Detected type: ${correctMimeType}`);
    
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
    
    console.log(`Worker ${workerId}: Using ${actualServiceName} for upload of ${fileName}`);
    
    // Create a temporary file to work with the service
    const fs = require('fs');
    const os = require('os');
    const tempFilePath = path.join(os.tmpdir(), `zentransfer_${Date.now()}_${fileName}`);
    
    try {
      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, fileBuffer);
      
      // Generate remote name with folder organization if needed
      //remoteName = generateRemoteName(fileData.filePath, importSettings);
      let remoteName = fileName;
      if (importSettings.destinationPath && importSettings.destinationPath.length > 0)
        remoteName = fileData.filePath.substr(importSettings.destinationPath.length+1).replaceAll('\\', '/');
      
      // Extract skipDuplicates setting from importSettings (default to true if not specified)
      const skipDuplicates = importSettings && importSettings.skipDuplicates !== undefined ? importSettings.skipDuplicates : true;
      
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
          skipDuplicates: skipDuplicates // Pass skipDuplicates setting to service
        }
      );
      // Restore original progress method
      uploadService._updateProgress = originalUpdateProgress;
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.message);
      }
      
      sendProgress(fileId, 100, 'Upload completed');
      
      return {
        fileId,
        status: 'completed',
        uploadId: uploadResult.details.zentransferUploadId,
        finalUrl: uploadResult.url
      };
      
    } finally {
      // Clean up temporary file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        console.warn(`Worker ${workerId}: Failed to clean up temp file: ${cleanupError.message}`);
      }
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
  console.log(`Upload worker ${workerId} shutting down`);
  process.exit(0);
});

/**
 * Get folder name for file organization based on import settings
 */
function getFolderName(file, importSettings) {
    if (!importSettings || !importSettings.organizeIntoFolders) {
        return ''; // No folder organization
    }
    
    const { folderOrganizationType, customFolderName, dateFormat } = importSettings;
    
    if (folderOrganizationType === 'custom') {
        return customFolderName || 'Imported Files';
    } else {
        // Use file creation/modification date or current date
        const fileStats = require('fs').statSync(file.path);
        const date = fileStats.birthtime || fileStats.mtime || new Date();
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
 * Generate remote name with folder organization
 */
function generateRemoteName(fileName, importSettings) {
    // Get folder name based on import settings
    const folderName = getFolderName({ path: fileName }, importSettings);
    
    if (folderName) {
        // Use forward slashes for cloud storage paths (works for S3, Azure, GCP)
        return `${folderName}/${fileName}`.replace(/\\/g, '/');
    } else {
        return fileName;
    }
}