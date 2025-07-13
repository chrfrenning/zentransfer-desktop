/**
 * Azure Blob Storage Upload Service
 * Handles uploads to Azure Blob Storage
 */

const { UploadServiceBase } = require('./upload-service-base.js');

class AzureBlobService extends UploadServiceBase {
    constructor(settings = {}) {
        super(settings);
        this.activeUploads = new Map();
        this.connectionParams = null;
    }

    getServiceName() {
        return 'Azure Blob Storage';
    }

    validateConfiguration() {
        const errors = [];
        
        if (!this.settings.connectionString) {
            errors.push('Azure connection string is required');
        }
        
        if (!this.settings.containerName) {
            errors.push('Azure container name is required');
        }

        // Parse and validate connection string
        if (this.settings.connectionString) {
            try {
                this.connectionParams = this._parseConnectionString(this.settings.connectionString);
                
                if (!this.connectionParams.accountName) {
                    errors.push('Connection string missing AccountName');
                }
                
                if (!this.connectionParams.accountKey) {
                    errors.push('Connection string missing AccountKey');
                }

                // Validate account name format
                if (this.connectionParams.accountName && 
                    !this.connectionParams.accountName.match(/^[a-z0-9]{3,24}$/)) {
                    errors.push('Invalid Azure storage account name format');
                }

                // Validate account key format (should be base64)
                if (this.connectionParams.accountKey) {
                    try {
                        atob(this.connectionParams.accountKey);
                    } catch (e) {
                        errors.push('Invalid Azure account key format - must be base64 encoded');
                    }
                }
            } catch (error) {
                errors.push('Invalid connection string format');
            }
        }

        // Validate container name format
        if (this.settings.containerName && 
            !this.settings.containerName.match(/^[a-z0-9-]{3,63}$/)) {
            errors.push('Invalid Azure container name format');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async testConnection() {
        this._log('info', 'Testing Azure Blob Storage connection');
        
        try {
            const validation = this.validateConfiguration();
            if (!validation.valid) {
                const result = {
                    success: false,
                    message: `Configuration invalid: ${validation.errors.join(', ')}`
                };
                this._storeTestResult(result);
                return result;
            }

            // Import Azure SDK
            const { BlobServiceClient } = require('@azure/storage-blob');

            // Create blob service client
            const blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.connectionString);
            
            // Test by getting account info
            const accountInfo = await blobServiceClient.getAccountInfo();
            
            // Test container access
            const containerClient = blobServiceClient.getContainerClient(this.settings.containerName);
            
            // Check if container exists and is accessible
            const containerExists = await containerClient.exists();
            
            if (!containerExists) {
                const result = {
                    success: false,
                    message: `Container '${this.settings.containerName}' does not exist or is not accessible`,
                    details: {
                        accountName: this.connectionParams.accountName,
                        containerName: this.settings.containerName
                    }
                };
                this._storeTestResult(result);
                return result;
            }

            const result = {
                success: true,
                message: 'Azure Blob Storage connection successful',
                details: {
                    accountName: this.connectionParams.accountName,
                    containerName: this.settings.containerName,
                    accountKind: accountInfo.accountKind,
                    skuName: accountInfo.skuName
                }
            };
            
            this._storeTestResult(result);
            this._log('info', 'Azure Blob Storage connection test completed');
            return result;

        } catch (error) {
            const result = {
                success: false,
                message: `Azure Blob Storage connection failed: ${error.message}`,
                details: { error: error.message }
            };
            
            this._storeTestResult(result);
            this._log('error', 'Azure Blob Storage connection test failed', { error: error.message });
            return result;
        }
    }

    /**
     * Check if a blob exists in Azure and is a duplicate
     * @param {string} remoteName - The remote blob name
     * @param {number} expectedSize - Expected file size for duplicate comparison
     * @returns {Promise<boolean>} True if blob exists and is a duplicate
     */
    async checkIfDuplicate(remoteName, expectedSize) {
        try {
            // Import Azure SDK
            const { BlobServiceClient } = require('@azure/storage-blob');

            // Create blob service client
            const blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.connectionString);
            
            // Get container client
            const containerClient = blobServiceClient.getContainerClient(this.settings.containerName);
            
            // Get block blob client
            const blockBlobClient = containerClient.getBlockBlobClient(remoteName);

            // Check if blob exists
            const exists = await blockBlobClient.exists();
            if (!exists) {
                return false;
            }

            // Get blob properties to check size
            const properties = await blockBlobClient.getProperties();
            
            // Check if file sizes match (basic duplicate detection)
            if (properties.contentLength === expectedSize) {
                this._log('info', 'Duplicate blob detected in Azure', { 
                    remoteName, 
                    expectedSize, 
                    actualSize: properties.contentLength 
                });
                return true;
            }
            
            return false;
        } catch (error) {
            // Any errors (permissions, network, etc.) - assume not duplicate to be safe
            this._log('warn', 'Error checking Azure duplicate', { error: error.message, remoteName });
            return false;
        }
    }

    /**
     * Generate a unique filename if the original already exists
     * @param {string} originalRemoteName - Original remote blob name
     * @param {number} fileSize - File size for duplicate comparison
     * @returns {Promise<string>} Unique remote name
     */
    async generateUniqueRemoteName(originalRemoteName, fileSize) {
        // Parse the original name to extract base name and extension
        const lastDotIndex = originalRemoteName.lastIndexOf('.');
        let baseName, extension;
        
        if (lastDotIndex === -1) {
            // No extension
            baseName = originalRemoteName;
            extension = '';
        } else {
            baseName = originalRemoteName.substring(0, lastDotIndex);
            extension = originalRemoteName.substring(lastDotIndex);
        }
        
        // Check if original name is available
        const originalExists = await this.checkIfDuplicate(originalRemoteName, fileSize);
        if (!originalExists) {
            return originalRemoteName;
        }
        
        // Find a unique name with counter
        let counter = 1;
        let uniqueName;
        
        do {
            uniqueName = `${baseName} (${counter})${extension}`;
            const exists = await this.checkIfDuplicate(uniqueName, fileSize);
            if (!exists) {
                break;
            }
            counter++;
        } while (counter < 1000); // Safety limit to prevent infinite loop
        
        if (counter >= 1000) {
            // Fallback: use timestamp
            const timestamp = Date.now();
            uniqueName = `${baseName}_${timestamp}${extension}`;
        }
        
        this._log('info', 'Generated unique filename for Azure upload', { 
            original: originalRemoteName, 
            unique: uniqueName 
        });
        
        return uniqueName;
    }

    async uploadFile(filePath, remoteName, mimeType, options = {}) {
        this._log('info', 'Starting Azure Blob Storage upload', { remoteName, mimeType });
        
        // Generate upload ID early so it's available in error handling
        const uploadId = this._generateUploadId();
        
        try {
            // Validate configuration
            if (!this.isServiceConfigured()) {
                throw new Error('Service not properly configured');
            }

            // Validate file
            const fileInfo = await this._validateFilePath(filePath);
            if (!fileInfo.exists || !fileInfo.isFile) {
                throw new Error(`File not found or not accessible: ${filePath}`);
            }

            const skipDuplicates = options.skipDuplicates !== undefined ? options.skipDuplicates : true;
            let finalRemoteName = remoteName;
            
            if (skipDuplicates) {
                // Original behavior: check for duplicates and skip if found
                this._updateProgress(uploadId, 5, 'Checking for duplicates...');
                const isDuplicate = await this.checkIfDuplicate(remoteName, fileInfo.size);
                if (isDuplicate) {
                    this._log('info', 'Skipping duplicate file upload to Azure', { remoteName, size: fileInfo.size });
                    
                    // Update upload status to skipped
                    this.activeUploads.set(uploadId, {
                        status: 'skipped',
                        progress: 100,
                        startTime: Date.now(),
                        endTime: Date.now()
                    });

                    return {
                        success: true,
                        skipped: true,
                        message: 'File skipped - duplicate already exists in Azure Blob Storage',
                        details: {
                            uploadId,
                            remoteName,
                            reason: 'duplicate'
                        }
                    };
                }
            } else {
                // New behavior: generate unique filename if original exists
                this._updateProgress(uploadId, 5, 'Checking for unique filename...');
                finalRemoteName = await this.generateUniqueRemoteName(remoteName, fileInfo.size);
                
                if (finalRemoteName !== remoteName) {
                    this._log('info', 'Using unique filename for Azure upload', { 
                        original: remoteName, 
                        unique: finalRemoteName 
                    });
                }
            }

            // Read file content
            const fileContent = await this._readFile(filePath);
            
            // Track upload
            this.activeUploads.set(uploadId, {
                status: 'uploading',
                progress: 0,
                startTime: Date.now()
            });

            this._updateProgress(uploadId, 10, 'Initializing Azure upload...');

            // Import Azure SDK
            const { BlobServiceClient } = require('@azure/storage-blob');

            // Create blob service client
            const blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.connectionString);
            
            // Get container client
            const containerClient = blobServiceClient.getContainerClient(this.settings.containerName);
            
            this._updateProgress(uploadId, 20, 'Uploading to Azure...');

            // Get block blob client with final remote name
            const blockBlobClient = containerClient.getBlockBlobClient(finalRemoteName);

            // Set blob HTTP headers
            const blobHTTPHeaders = {
                blobContentType: mimeType
            };

            // Add metadata if provided
            const metadata = options.metadata || {};

            // Upload the file
            const uploadResponse = await blockBlobClient.upload(fileContent, fileContent.length, {
                blobHTTPHeaders,
                metadata
            });

            this._updateProgress(uploadId, 90, 'Upload completed');

            // Construct the blob URL with final remote name
            const blobUrl = blockBlobClient.url;
            
            // Update upload status
            this.activeUploads.set(uploadId, {
                status: 'completed',
                progress: 100,
                startTime: this.activeUploads.get(uploadId).startTime,
                endTime: Date.now()
            });

            const uploadResult = {
                success: true,
                url: blobUrl,
                message: 'File uploaded successfully to Azure Blob Storage',
                details: {
                    uploadId,
                    size: fileInfo.size,
                    remoteName: finalRemoteName, // Use final name in response
                    originalRemoteName: remoteName, // Include original name for reference
                    mimeType,
                    accountName: this.connectionParams.accountName,
                    containerName: this.settings.containerName,
                    etag: uploadResponse.etag,
                    requestId: uploadResponse.requestId,
                    wasRenamed: finalRemoteName !== remoteName
                }
            };

            this._log('info', 'Azure Blob Storage upload completed', uploadResult.details);
            return uploadResult;

        } catch (error) {
            // Update upload status to failed
            if (this.activeUploads.has(uploadId)) {
                this.activeUploads.set(uploadId, {
                    ...this.activeUploads.get(uploadId),
                    status: 'failed',
                    progress: 0,
                    endTime: Date.now(),
                    error: error.message
                });
            }

            const uploadResult = {
                success: false,
                message: `Azure Blob Storage upload failed: ${error.message}`,
                details: { error: error.message, filePath, remoteName }
            };

            this._log('error', 'Azure Blob Storage upload failed', uploadResult.details);
            return uploadResult;
        }
    }

    async getUploadProgress(uploadId) {
        const upload = this.activeUploads.get(uploadId);
        if (!upload) {
            return { progress: 0, status: 'not_found' };
        }

        return {
            progress: upload.progress,
            status: upload.status,
            startTime: upload.startTime,
            endTime: upload.endTime
        };
    }

    async cancelUpload(uploadId) {
        const upload = this.activeUploads.get(uploadId);
        if (!upload || upload.status !== 'uploading') {
            return false;
        }

        this.activeUploads.set(uploadId, {
            ...upload,
            status: 'cancelled',
            endTime: Date.now()
        });

        this._log('info', 'Azure Blob Storage upload cancelled', { uploadId });
        return true;
    }

    sanitizeSettings(settings) {
        const sanitized = super.sanitizeSettings(settings);
        
        // Azure-specific sensitive fields
        if (sanitized.connectionString) {
            // Show only the account name part, redact the key
            const parts = sanitized.connectionString.split(';');
            const sanitizedParts = parts.map(part => {
                if (part.startsWith('AccountKey=')) {
                    return 'AccountKey=[REDACTED]';
                }
                return part;
            });
            sanitized.connectionString = sanitizedParts.join(';');
        }
        
        return sanitized;
    }

    /**
     * Parse Azure connection string
     * @param {string} connectionString - Azure storage connection string
     * @returns {Object} Parsed connection parameters
     * @private
     */
    _parseConnectionString(connectionString) {
        const params = {};
        const parts = connectionString.split(';');
        
        for (const part of parts) {
            const [key, value] = part.split('=');
            if (key && value) {
                params[key] = value;
            }
        }
        
        return {
            accountName: params.AccountName,
            accountKey: params.AccountKey,
            endpointSuffix: params.EndpointSuffix || 'core.windows.net',
            protocol: params.DefaultEndpointsProtocol || 'https'
        };
    }

    /**
     * Get the blob endpoint URL for the configured account and container
     * @returns {string} Blob endpoint URL
     */
    getEndpointUrl() {
        if (!this.connectionParams) {
            this.connectionParams = this._parseConnectionString(this.settings.connectionString);
        }
        return `https://${this.connectionParams.accountName}.blob.core.windows.net/${this.settings.containerName}/`;
    }

    /**
     * Get the account name from the connection string
     * @returns {string|null} Account name or null if not configured
     */
    getAccountName() {
        if (!this.connectionParams) {
            try {
                this.connectionParams = this._parseConnectionString(this.settings.connectionString);
            } catch (error) {
                return null;
            }
        }
        return this.connectionParams?.accountName || null;
    }

    /**
     * Update upload progress
     * @param {string} uploadId - Upload ID
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} status - Status message
     * @private
     */
    _updateProgress(uploadId, progress, status) {
        if (this.activeUploads.has(uploadId)) {
            const upload = this.activeUploads.get(uploadId);
            this.activeUploads.set(uploadId, {
                ...upload,
                progress,
                status
            });
        }
    }
}

module.exports = { AzureBlobService }; 