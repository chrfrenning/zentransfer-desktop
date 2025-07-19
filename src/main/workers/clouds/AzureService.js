/**
 * Azure Blob Storage Upload Service
 * Handles uploads to Azure Blob Storage
 */

const { StorageServiceBase } = require('./StorageServiceBase.js');
const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');

const AZURE_UPLOAD_BUFFER_SIZE = 4 * 1024 * 1024;
const MAX_AZURE_CONCURRENCY = 5;

class AzureService extends StorageServiceBase {
    constructor(settings = {}) {
        super(settings);
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
                this._log('error', 'Connection test failed, invalid configuration');
                return false;
            }

            // Create blob service client
            const blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.connectionString);
            
            // Test by getting account info
            const accountInfo = await blobServiceClient.getAccountInfo();
            
            // Test container access
            const containerClient = blobServiceClient.getContainerClient(this.settings.containerName);
            
            // Check if container exists and is accessible
            const containerExists = await containerClient.exists();
            
            if (!containerExists) {
                this._log('error', `Container '${this.settings.containerName}' does not exist or is not accessible`);
                return false;
            }

            this._log('info', 'Azure Blob Storage connection test completed');
            return true;

        } catch (error) {
            
            this._log('error', 'Azure Blob Storage connection test failed', { error: error.message });
            return false;

        }
    }
    
    async checkIfDuplicate(remoteName, expectedSize) {
        try {

            const blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.connectionString);
            const containerClient = blobServiceClient.getContainerClient(this.settings.containerName);
            const blockBlobClient = containerClient.getBlockBlobClient(remoteName);

            const exists = await blockBlobClient.exists();
            if (!exists) {
                return {
                    exists: false,
                    isDuplicate: false
                };
            }

            const properties = await blockBlobClient.getProperties();
            
            if (properties.contentLength === expectedSize) {
                this._log('info', 'Duplicate blob detected in Azure', { 
                    remoteName, 
                    expectedSize, 
                    actualSize: properties.contentLength 
                });

                return {
                    exists: true,
                    isDuplicate: true
                };
            }
            
            return {
                exists: true,
                isDuplicate: false
            };

        } catch (error) {
            // Any errors (permissions, network, etc.) - assume not duplicate to be safe
            this._log('warn', 'Error checking Azure duplicate', { error: error.message, remoteName });
            return {
                exists: false,
                isDuplicate: false
            };
        }
    }

    async uploadOriginalFile(filePath, remoteName, mimeType, options = {}) {
        this._log('info', 'Starting Azure Blob Storage upload', { remoteName, mimeType });
        
        try {
        
            // Validate configuration
            if (!this.validateConfiguration().valid) {
                throw new Error('Service not properly configured');
            }

            // Validate file
            const fileInfo = await this._validateFilePath(filePath);
            if (!fileInfo.exists || !fileInfo.isFile) {
                throw new Error(`File not found or not accessible: ${filePath}`);
            }

            this._emitProgress(0, fileInfo.size);

            let finalRemoteName = remoteName;
            if (options.skipDuplicates) {
                const dupeCheck = await this.checkIfDuplicate(remoteName, fileInfo.size);
                if ( dupeCheck.isDuplicate ) {
                    this._log('info', 'Skipping duplicate file upload to Azure', { remoteName, size: fileInfo.size });
                    return {
                        success: true,
                        url: `${this.getEndpointUrl()}/${remoteName}`,
                        skipped: true
                    }
                }
            } else {

                finalRemoteName = await this.generateUniqueRemoteName(remoteName);

            }

            // Read file content
            this._emitProgress(1, fileInfo.size);
            const readStream = fs.createReadStream(filePath);

            const blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.connectionString);
            const containerClient = blobServiceClient.getContainerClient(this.settings.containerName);
            const blockBlobClient = containerClient.getBlockBlobClient(finalRemoteName);


            // Upload the file
            const blobHTTPHeaders = {
                blobContentType: mimeType
            };

            const metadata = options.metadata || {};

            const uploadResponse = await blockBlobClient.uploadStream(
                readStream,
                AZURE_UPLOAD_BUFFER_SIZE,
                MAX_AZURE_CONCURRENCY,
                {
                    blobHTTPHeaders,
                    metadata,
                    onProgress: (progress) => {
                        this._emitProgress(progress.loadedBytes, fileInfo.size);
                    }
                }
            );

            this._log('info', 'Azure Blob Storage upload completed', uploadResponse);
            this._emitProgress(fileInfo.size, fileInfo.size);

            const blobUrl = blockBlobClient.url;
            return {
                success: true,
                url: blobUrl
            };

        } catch (error) {

            this._log('error', 'Azure Blob Storage upload failed', error);

            return {
                success: false,
                message: `Azure Blob Storage upload failed: ${error.message}`
            };
        }
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
     * List files in a given path
     * @param {string} path - Path to list files from (empty string for root)
     * @returns {Promise<Object>} List result with files array
     */
    async listFiles(path = '') {
        this._log('info', 'Listing files in Azure Blob Storage', { path });
        
        try {
            // Validate configuration
            if (!this.validateConfiguration()) {
                throw new Error('Service not properly configured');
            }

            // Import Azure SDK
            const { BlobServiceClient } = require('@azure/storage-blob');

            // Create blob service client
            const blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.connectionString);
            const containerClient = blobServiceClient.getContainerClient(this.settings.containerName);

            const files = [];
            const listOptions = {
                prefix: path,
                includeMetadata: true
            };

            // List blobs
            for await (const blob of containerClient.listBlobsFlat(listOptions)) {
                // Skip the path itself if it's a directory marker
                if (blob.name !== path && blob.name !== path + '/') {
                    files.push({
                        name: blob.name.replace(path, '').replace(/^\//, ''),
                        size: blob.properties.contentLength,
                        modified: blob.properties.lastModified,
                        isDirectory: false
                    });
                }
            }

            this._log('info', 'Azure Blob Storage file listing completed', { path, fileCount: files.length });
            
            return {
                success: true,
                files: files,
                message: `Listed ${files.length} files`,
                details: {
                    path,
                    containerName: this.settings.containerName,
                    accountName: this.connectionParams.accountName
                }
            };

        } catch (error) {
            this._log('error', 'Azure Blob Storage file listing failed', { error: error.message, path });
            return {
                success: false,
                files: [],
                message: `Failed to list files: ${error.message}`,
                details: { error: error.message, path }
            };
        }
    }

    /**
     * Download a file from Azure Blob Storage
     * @param {string} filename - Name of the file to download
     * @param {string} localPath - Local path to save the file
     * @returns {Promise<Object>} Download result
     */
    async downloadFile(filename, localPath) {
        this._log('info', 'Downloading file from Azure Blob Storage', { filename, localPath });
        
        try {
            // Validate configuration
            if (!this.validateConfiguration()) {
                throw new Error('Service not properly configured');
            }

            // Import Azure SDK
            const { BlobServiceClient } = require('@azure/storage-blob');
            const fs = require('fs').promises;
            const path = require('path');

            // Create blob service client
            const blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.connectionString);
            const containerClient = blobServiceClient.getContainerClient(this.settings.containerName);
            const blockBlobClient = containerClient.getBlockBlobClient(filename);

            // Download blob
            const downloadResponse = await blockBlobClient.download(0);
            const downloadedContent = await this._streamToBuffer(downloadResponse.readableStreamBody);

            // Ensure directory exists
            const dir = path.dirname(localPath);
            await fs.mkdir(dir, { recursive: true });

            // Write file
            await fs.writeFile(localPath, downloadedContent);

            this._log('info', 'Azure Blob Storage file download completed', { filename, localPath, size: downloadedContent.length });
            
            return {
                success: true,
                localPath: localPath,
                message: 'File downloaded successfully',
                details: {
                    filename,
                    localPath,
                    size: downloadedContent.length,
                    containerName: this.settings.containerName,
                    accountName: this.connectionParams.accountName
                }
            };

        } catch (error) {
            this._log('error', 'Azure Blob Storage file download failed', { error: error.message, filename });
            return {
                success: false,
                message: `Failed to download file: ${error.message}`,
                details: { error: error.message, filename, localPath }
            };
        }
    }

    /**
     * Create a shareable URL with expiration for Azure Blob Storage
     * @param {string} filename - Name of the file to create URL for
     * @param {Date|number} expiresAt - Expiration date or timestamp
     * @returns {Promise<Object>} URL result
     */
    async createShareableUrl(filename, expiresAt) {
        this._log('info', 'Creating shareable URL for Azure Blob Storage', { filename, expiresAt });
        
        try {
            // Validate configuration
            if (!this.validateConfiguration()) {
                throw new Error('Service not properly configured');
            }

            // Import Azure SDK
            const { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');

            // Create blob service client
            const blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.connectionString);
            const containerClient = blobServiceClient.getContainerClient(this.settings.containerName);
            const blockBlobClient = containerClient.getBlockBlobClient(filename);

            // Convert expiresAt to Date
            const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

            if (expirationDate.getTime() <= Date.now()) {
                throw new Error('Expiration time must be in the future');
            }

            // Generate SAS token
            const sasOptions = {
                containerName: this.settings.containerName,
                blobName: filename,
                permissions: BlobSASPermissions.parse('r'), // Read permission
                startsOn: new Date(),
                expiresOn: expirationDate,
                resource: 'b'
            };

            const sasToken = generateBlobSASQueryParameters(sasOptions, blobServiceClient.credential).toString();
            const sasUrl = `${blockBlobClient.url}?${sasToken}`;

            this._log('info', 'Azure Blob Storage shareable URL created', { filename, expiresAt: expirationDate });
            
            return {
                success: true,
                url: sasUrl,
                expiresAt: expirationDate,
                message: 'Shareable URL created successfully',
                details: {
                    filename,
                    expiresAt: expirationDate,
                    containerName: this.settings.containerName,
                    accountName: this.connectionParams.accountName
                }
            };

        } catch (error) {
            this._log('error', 'Azure Blob Storage shareable URL creation failed', { error: error.message, filename });
            return {
                success: false,
                message: `Failed to create shareable URL: ${error.message}`,
                details: { error: error.message, filename, expiresAt }
            };
        }
    }

    /**
     * Helper method to convert stream to buffer
     * @param {ReadableStream} readableStream - Stream to convert
     * @returns {Promise<Buffer>} Buffer containing stream data
     * @private
     */
    async _streamToBuffer(readableStream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            readableStream.on('data', (data) => {
                chunks.push(data instanceof Buffer ? data : Buffer.from(data));
            });
            readableStream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
            readableStream.on('error', reject);
        });
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

module.exports = { AzureService }; 