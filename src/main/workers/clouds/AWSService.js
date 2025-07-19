/**
 * AWS S3 Upload Service
 * Handles uploads to Amazon S3
 */

const { StorageServiceBase } = require('./StorageServiceBase.js');
const { S3Client, HeadObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');

class AWSService extends StorageServiceBase {
    constructor(settings = {}) {
        super(settings);
    }

    getServiceName() {
        return 'AWS S3';
    }

    validateConfiguration() {
        const errors = [];
        
        if (!this.settings.region) {
            errors.push('AWS region is required');
        }
        
        if (!this.settings.bucket) {
            errors.push('S3 bucket name is required');
        }
        
        if (!this.settings.accessKey) {
            errors.push('AWS access key is required');
        }
        
        if (!this.settings.secretKey) {
            errors.push('AWS secret key is required');
        }

        // Validate formats
        if (this.settings.accessKey && !this.settings.accessKey.match(/^(AKIA|ASIA)[A-Z0-9]{16}$/)) {
            errors.push('Invalid AWS access key format');
        }

        if (this.settings.secretKey && this.settings.secretKey.length < 40) {
            errors.push('AWS secret key appears to be too short');
        }

        if (this.settings.region && !this.settings.region.match(/^[a-z0-9-]+$/)) {
            errors.push('Invalid AWS region format');
        }

        if (this.settings.bucket && !this.settings.bucket.match(/^[a-z0-9.-]+$/)) {
            errors.push('Invalid S3 bucket name format');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async testConnection() {
        this._log('info', 'Testing AWS S3 connection');
        
        try {
            const validation = this.validateConfiguration();
            if (!validation.valid) {
                this._log('error', 'Connection test failed, invalid configuration');
                return false;
            }

            // Create S3 client with credentials
            const s3Client = new S3Client({
                region: this.settings.region,
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                }
            });

            // Test 1: Check if bucket exists and we have access to it
            let bucketLocation = null;
            try {

                const headBucketCommand = new HeadBucketCommand({
                    Bucket: this.settings.bucket
                });
                const headBucketResponse = await s3Client.send(headBucketCommand);
                this._log('info', 'Bucket head request successful');
                
                // Get bucket location if available in response headers
                bucketLocation = headBucketResponse.BucketRegion || this.settings.region;

            } catch (headError) {
                // Provide specific error messages based on the error type
                if (headError.name === 'NoSuchBucket') {
                    this._log('error', `Bucket '${this.settings.bucket}' does not exist in region '${this.settings.region}'`);
                } else if (headError.name === 'Forbidden' || headError.$metadata?.httpStatusCode === 403) {
                    this._log('error', `Access denied to bucket '${this.settings.bucket}'. Check your AWS credentials and bucket permissions.`);
                } else if (headError.name === 'InvalidAccessKeyId') {
                    this._log('error', 'Invalid AWS access key ID');
                } else if (headError.name === 'SignatureDoesNotMatch') {
                    this._log('error', 'Invalid AWS secret access key');
                } else {
                    this._log('error', `Connection failed: ${headError.message}`);
                }
                    
                return false;
            }

            // Test 2: Try to list objects to verify read permissions
            let objectCount = 0;
            let hasListPermission = true;
            
            try {

                const listCommand = new ListObjectsV2Command({
                    Bucket: this.settings.bucket,
                    MaxKeys: 10 // Limit to 10 objects for testing
                });

                const listResponse = await s3Client.send(listCommand);
                objectCount = listResponse.KeyCount || 0;
                
                this._log('info', 'Successfully listed bucket objects', { 
                    objectCount,
                    sampleObjects: listResponse.Contents ? listResponse.Contents.slice(0, 3).map(obj => obj.Key) : []
                });

            } catch (listError) {

                // If we can list, that's great, but if we can't, we'll note it but still consider the test successful
                // since we were able to verify the bucket exists and credentials work
                hasListPermission = false;
                this._log('warn', 'Could not list bucket objects, but bucket access confirmed', { error: listError.message });

            }

            this._log('info', 'AWS S3 connection test completed successfully');
            return true;

        } catch (error) {

            this._log('error', 'AWS S3 connection test failed', { error: error.message });
            return false;

        }
    }
    
    async checkIfDuplicate(remoteName, expectedSize) {
        try {
            // Create S3 client
            const s3Client = new S3Client({
                region: this.settings.region,
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                }
            });

            // Try to get object metadata
            const headCommand = new HeadObjectCommand({
                Bucket: this.settings.bucket,
                Key: remoteName
            });

            const response = await s3Client.send(headCommand);
            
            // Check if file sizes match (basic duplicate detection)
            if (response.ContentLength === expectedSize) {
                this._log('info', 'Duplicate file detected in S3', { 
                    remoteName, 
                    expectedSize, 
                    actualSize: response.ContentLength 
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

            if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
                // File doesn't exist, not a duplicate
                return {
                    exists: false,
                    isDuplicate: false
                };
            }
            
            // Other errors (permissions, network, etc.) - assume not duplicate to be safe
            this._log('warn', 'Error checking S3 duplicate', { error: error.message, remoteName });
            return {
                exists: false,
                isDuplicate: false
            };
        }
    }

    async uploadOriginalFile(filePath, remoteName, mimeType, options = {}) {
        this._log('info', 'Starting AWS S3 upload', { remoteName, mimeType });
        
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

            // Check for duplicates and generate unique name if needed
            let finalRemoteName = remoteName;
            if (options.skipDuplicates) {
                // Original behavior: check for duplicates and skip if found
                const dupeCheck = await this.checkIfDuplicate(remoteName, fileInfo.size);
                if ( dupeCheck.isDuplicate ) {
                    this._log('info', 'Skipping duplicate file upload to S3', { remoteName, size: fileInfo.size });
                    
                    return {
                        success: true,
                        url: `${this.getEndpointUrl()}/${remoteName}`,
                        skipped: true
                    };
                }
            } else {

                finalRemoteName = await this.generateUniqueRemoteName(remoteName);

            }

            // Read file content
            this._emitProgress(1, fileInfo.size);
            const fileContent = await this._readFile(filePath);

            // Create S3 client
            const s3Client = new S3Client({
                region: this.settings.region,
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                }
            });

            // Prepare upload parameters with final remote name
            const uploadParams = {
                Bucket: this.settings.bucket,
                Key: finalRemoteName,
                Body: fileContent,
                ContentType: mimeType,
                StorageClass: this.settings.storageClass || 'STANDARD'
            };

            // Add metadata if provided
            if (options.metadata) {
                uploadParams.Metadata = options.metadata;
            }

            // Upload to S3
            this._emitProgress(2, fileInfo.size);
            const command = new PutObjectCommand(uploadParams);
            const response = await s3Client.send(command);
            this._emitProgress(fileInfo.size, fileInfo.size);

            // Construct the S3 URL with final remote name
            const s3Url = `https://${this.settings.bucket}.s3.${this.settings.region}.amazonaws.com/${finalRemoteName}`;

            const result = {
                success: true,
                url: s3Url
            };

            this._log('info', 'AWS S3 upload completed', result);
            return result;

        } catch (error) {

            return {
                success: false,
                message: `AWS S3 upload failed: ${error.message}`
            };
            
        }
    }

    /**
     * Get the S3 endpoint URL for the configured bucket and region
     * @returns {string} S3 endpoint URL
     */
    getEndpointUrl() {
        return `https://${this.settings.bucket}.s3.${this.settings.region}.amazonaws.com/`;
    }

    /**
     * Get supported storage classes
     * @returns {Array} Array of storage class options
     */
    static getStorageClasses() {
        return [
            { value: 'STANDARD', label: 'Standard - Frequently accessed data' },
            { value: 'REDUCED_REDUNDANCY', label: 'Reduced Redundancy - Non-critical, reproducible data' },
            { value: 'STANDARD_IA', label: 'Standard-IA - Infrequently accessed data' },
            { value: 'ONEZONE_IA', label: 'One Zone-IA - Infrequently accessed, non-critical data' },
            { value: 'INTELLIGENT_TIERING', label: 'Intelligent Tiering - Automatic cost optimization' },
            { value: 'GLACIER', label: 'Glacier - Long-term archive (minutes to hours retrieval)' },
            { value: 'DEEP_ARCHIVE', label: 'Glacier Deep Archive - Long-term archive (12+ hours retrieval)' },
            { value: 'GLACIER_IR', label: 'Glacier Instant Retrieval - Archive with instant access' }
        ];
    }

    /**
     * List files in a given path
     * @param {string} path - Path to list files from (empty string for root)
     * @returns {Promise<Object>} List result with files array
     */
    async listFiles(path = '') {
        this._log('info', 'Listing files in AWS S3', { path });
        
        try {
            // Validate configuration
            if (!this.validateConfiguration()) {
                throw new Error('Service not properly configured');
            }

            // Import AWS SDK
            const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

            // Create S3 client
            const s3Client = new S3Client({
                region: this.settings.region,
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                }
            });

            // Prepare list command
            const listCommand = new ListObjectsV2Command({
                Bucket: this.settings.bucket,
                Prefix: path,
                Delimiter: '/'
            });

            const response = await s3Client.send(listCommand);
            const files = [];

            // Add directories (common prefixes)
            if (response.CommonPrefixes) {
                response.CommonPrefixes.forEach(prefix => {
                    files.push({
                        name: prefix.Prefix.replace(path, '').replace('/', ''),
                        size: 0,
                        modified: null,
                        isDirectory: true
                    });
                });
            }

            // Add files (contents)
            if (response.Contents) {
                response.Contents.forEach(object => {
                    // Skip the path itself if it's a directory
                    if (object.Key !== path && object.Key !== path + '/') {
                        files.push({
                            name: object.Key.replace(path, '').replace(/^\//, ''),
                            size: object.Size,
                            modified: object.LastModified,
                            isDirectory: false
                        });
                    }
                });
            }

            this._log('info', 'AWS S3 file listing completed', { path, fileCount: files.length });
            
            return {
                success: true,
                files: files,
                message: `Listed ${files.length} files/directories`,
                details: {
                    path,
                    bucket: this.settings.bucket,
                    region: this.settings.region
                }
            };

        } catch (error) {
            this._log('error', 'AWS S3 file listing failed', { error: error.message, path });
            return {
                success: false,
                files: [],
                message: `Failed to list files: ${error.message}`,
                details: { error: error.message, path }
            };
        }
    }

    /**
     * Download a file from AWS S3
     * @param {string} filename - Name of the file to download
     * @param {string} localPath - Local path to save the file
     * @returns {Promise<Object>} Download result
     */
    async downloadFile(filename, localPath) {
        this._log('info', 'Downloading file from AWS S3', { filename, localPath });
        
        try {
            // Validate configuration
            if (!this.validateConfiguration()) {
                throw new Error('Service not properly configured');
            }

            // Import AWS SDK
            const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
            const fs = require('fs').promises;
            const path = require('path');

            // Create S3 client
            const s3Client = new S3Client({
                region: this.settings.region,
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                }
            });

            // Get object command
            const getCommand = new GetObjectCommand({
                Bucket: this.settings.bucket,
                Key: filename
            });

            const response = await s3Client.send(getCommand);
            
            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            // Ensure directory exists
            const dir = path.dirname(localPath);
            await fs.mkdir(dir, { recursive: true });

            // Write file
            await fs.writeFile(localPath, fileBuffer);

            this._log('info', 'AWS S3 file download completed', { filename, localPath, size: fileBuffer.length });
            
            return {
                success: true,
                localPath: localPath,
                message: 'File downloaded successfully',
                details: {
                    filename,
                    localPath,
                    size: fileBuffer.length,
                    bucket: this.settings.bucket,
                    region: this.settings.region
                }
            };

        } catch (error) {
            this._log('error', 'AWS S3 file download failed', { error: error.message, filename });
            return {
                success: false,
                message: `Failed to download file: ${error.message}`,
                details: { error: error.message, filename, localPath }
            };
        }
    }

    /**
     * Create a shareable URL with expiration for AWS S3
     * @param {string} filename - Name of the file to create URL for
     * @param {Date|number} expiresAt - Expiration date or timestamp
     * @returns {Promise<Object>} URL result
     */
    async createShareableUrl(filename, expiresAt) {
        this._log('info', 'Creating shareable URL for AWS S3', { filename, expiresAt });
        
        try {
            // Validate configuration
            if (!this.validateConfiguration()) {
                throw new Error('Service not properly configured');
            }

            // Import AWS SDK
            const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
            const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

            // Create S3 client
            const s3Client = new S3Client({
                region: this.settings.region,
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                }
            });

            // Convert expiresAt to seconds from now
            const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
            const expiresInSeconds = Math.floor((expirationDate.getTime() - Date.now()) / 1000);

            if (expiresInSeconds <= 0) {
                throw new Error('Expiration time must be in the future');
            }

            // Create command
            const command = new GetObjectCommand({
                Bucket: this.settings.bucket,
                Key: filename
            });

            // Generate presigned URL
            const presignedUrl = await getSignedUrl(s3Client, command, {
                expiresIn: expiresInSeconds
            });

            this._log('info', 'AWS S3 shareable URL created', { filename, expiresAt: expirationDate });
            
            return {
                success: true,
                url: presignedUrl,
                expiresAt: expirationDate,
                message: 'Shareable URL created successfully',
                details: {
                    filename,
                    expiresAt: expirationDate,
                    expiresInSeconds,
                    bucket: this.settings.bucket,
                    region: this.settings.region
                }
            };

        } catch (error) {
            this._log('error', 'AWS S3 shareable URL creation failed', { error: error.message, filename });
            return {
                success: false,
                message: `Failed to create shareable URL: ${error.message}`,
                details: { error: error.message, filename, expiresAt }
            };
        }
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

module.exports = { AWSService }; 