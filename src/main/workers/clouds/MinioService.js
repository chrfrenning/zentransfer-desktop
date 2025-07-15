/**
 * MinIO Upload Service
 * Handles uploads to MinIO (S3-compatible storage)
 */

const { StorageServiceBase } = require('./StorageServiceBase.js');

class MinioService extends StorageServiceBase {
    constructor(settings = {}) {
        super(settings);
        this.activeUploads = new Map();
    }

    getServiceName() {
        return 'MinIO';
    }

    validateConfiguration() {
        const errors = [];
        
        if (!this.settings.endpoint) {
            errors.push('MinIO endpoint is required');
        }
        
        if (!this.settings.bucket) {
            errors.push('MinIO bucket name is required');
        }
        
        if (!this.settings.accessKey) {
            errors.push('MinIO access key is required');
        }
        
        if (!this.settings.secretKey) {
            errors.push('MinIO secret key is required');
        }

        // Validate formats
        if (this.settings.endpoint && !this.settings.endpoint.match(/^[a-zA-Z0-9.-]+$/)) {
            errors.push('Invalid MinIO endpoint format');
        }

        if (this.settings.bucket && !this.settings.bucket.match(/^[a-z0-9.-]+$/)) {
            errors.push('Invalid MinIO bucket name format');
        }

        if (this.settings.port && (!Number.isInteger(this.settings.port) || this.settings.port < 1 || this.settings.port > 65535)) {
            errors.push('MinIO port must be a valid port number (1-65535)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async testConnection() {
        this._log('info', 'Testing MinIO connection');
        
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

            // Import AWS SDK to use with MinIO
            const { S3Client, HeadBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

            // Create S3 client configured for MinIO
            const s3Client = new S3Client({
                endpoint: this.getMinioEndpoint(),
                region: this.settings.region || 'us-east-1',
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                },
                forcePathStyle: true, // MinIO requires path-style URLs
                tls: this.settings.useSSL !== false // Default to true
            });

            this._log('info', 'Testing MinIO bucket access', { 
                endpoint: this.settings.endpoint,
                bucket: this.settings.bucket,
                port: this.settings.port,
                useSSL: this.settings.useSSL,
                accessKeyId: this.settings.accessKey.substring(0, 8) + '...[REDACTED]'
            });

            // Test 1: Check if bucket exists and we have access to it
            try {
                const headBucketCommand = new HeadBucketCommand({
                    Bucket: this.settings.bucket
                });
                const headBucketResponse = await s3Client.send(headBucketCommand);
                this._log('info', 'MinIO bucket head request successful');
            } catch (error) {
                this._log('error', 'MinIO bucket head request failed', { 
                    error: error.message,
                    code: error.name
                });
                
                if (error.name === 'NotFound' || error.name === 'NoSuchBucket') {
                    const result = {
                        success: false,
                        message: `MinIO bucket '${this.settings.bucket}' does not exist or is not accessible`
                    };
                    this._storeTestResult(result);
                    return result;
                } else if (error.name === 'Forbidden' || error.name === 'AccessDenied') {
                    const result = {
                        success: false,
                        message: 'Access denied to MinIO bucket. Check your credentials and permissions.'
                    };
                    this._storeTestResult(result);
                    return result;
                } else if (error.name === 'NetworkingError' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                    const result = {
                        success: false,
                        message: `Cannot connect to MinIO server at ${this.settings.endpoint}:${this.settings.port}. Check endpoint and network connectivity.`
                    };
                    this._storeTestResult(result);
                    return result;
                } else {
                    const result = {
                        success: false,
                        message: `MinIO connection failed: ${error.message}`
                    };
                    this._storeTestResult(result);
                    return result;
                }
            }

            // Test 2: Try to list objects to verify read access
            try {
                const listCommand = new ListObjectsV2Command({
                    Bucket: this.settings.bucket,
                    MaxKeys: 1
                });
                const listResponse = await s3Client.send(listCommand);
                this._log('info', 'MinIO list objects successful', { 
                    keyCount: listResponse.KeyCount || 0
                });
            } catch (error) {
                this._log('warn', 'MinIO list objects failed (bucket might be empty or no list permission)', { 
                    error: error.message 
                });
                // Not a critical failure - bucket head succeeded
            }

            // Test 3: Test upload permission by uploading a small test file
            try {
                const testKey = `zentransfer-test-${Date.now()}.txt`;
                const testContent = Buffer.from('ZenTransfer connection test', 'utf8');
                
                const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
                
                const putCommand = new PutObjectCommand({
                    Bucket: this.settings.bucket,
                    Key: testKey,
                    Body: testContent,
                    ContentType: 'text/plain'
                });
                
                await s3Client.send(putCommand);
                this._log('info', 'MinIO test upload successful');
                
                // Clean up test file
                try {
                    const deleteCommand = new DeleteObjectCommand({
                        Bucket: this.settings.bucket,
                        Key: testKey
                    });
                    await s3Client.send(deleteCommand);
                    this._log('info', 'MinIO test file cleanup successful');
                } catch (deleteError) {
                    this._log('warn', 'MinIO test file cleanup failed', { error: deleteError.message });
                }
                
            } catch (error) {
                this._log('error', 'MinIO test upload failed', { error: error.message });
                const result = {
                    success: false,
                    message: `MinIO upload test failed: ${error.message}. Check write permissions.`
                };
                this._storeTestResult(result);
                return result;
            }

            const result = {
                success: true,
                message: 'MinIO connection successful! All tests passed.',
                details: {
                    endpoint: this.settings.endpoint,
                    bucket: this.settings.bucket,
                    region: this.settings.region,
                    useSSL: this.settings.useSSL,
                    port: this.settings.port
                }
            };
            this._storeTestResult(result);
            return result;

        } catch (error) {
            this._log('error', 'MinIO connection test failed', { error: error.message });
            const result = {
                success: false,
                message: `MinIO connection test failed: ${error.message}`
            };
            this._storeTestResult(result);
            return result;
        }
    }

    /**
     * Check if a file with the same name and size already exists
     * @param {string} remoteName - Remote file name
     * @param {number} expectedSize - Expected file size
     * @returns {Promise<boolean>} True if duplicate exists
     */
    async checkIfDuplicate(remoteName, expectedSize) {
        try {
            const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
            
            const s3Client = new S3Client({
                endpoint: this.getMinioEndpoint(),
                region: this.settings.region || 'us-east-1',
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                },
                forcePathStyle: true,
                tls: this.settings.useSSL !== false
            });

            const headCommand = new HeadObjectCommand({
                Bucket: this.settings.bucket,
                Key: remoteName
            });

            const response = await s3Client.send(headCommand);
            
            // Check if file exists and has the same size
            const existingSize = response.ContentLength;
            const isDuplicate = existingSize === expectedSize;
            
            this._log('info', 'MinIO duplicate check completed', {
                remoteName,
                expectedSize,
                existingSize,
                isDuplicate
            });
            
            return isDuplicate;
            
        } catch (error) {
            if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
                // File doesn't exist, so it's not a duplicate
                return false;
            }
            
            this._log('warn', 'MinIO duplicate check failed', { 
                remoteName, 
                error: error.message 
            });
            return false; // Assume not duplicate if check fails
        }
    }

    /**
     * Generate a unique remote name by appending a counter
     * @param {string} originalRemoteName - Original remote name
     * @param {number} fileSize - File size for duplicate checking
     * @returns {Promise<string>} Unique remote name
     */
    async generateUniqueRemoteName(originalRemoteName, fileSize) {
        let counter = 1;
        let uniqueName = originalRemoteName;
        
        while (await this.checkIfDuplicate(uniqueName, fileSize)) {
            const lastDotIndex = originalRemoteName.lastIndexOf('.');
            if (lastDotIndex === -1) {
                uniqueName = `${originalRemoteName} (${counter})`;
            } else {
                const baseName = originalRemoteName.substring(0, lastDotIndex);
                const extension = originalRemoteName.substring(lastDotIndex);
                uniqueName = `${baseName} (${counter})${extension}`;
            }
            counter++;
            
            // Safety check to prevent infinite loops
            if (counter > 1000) {
                this._log('warn', 'MinIO unique name generation exceeded limit', { originalRemoteName });
                break;
            }
        }
        
        return uniqueName;
    }

    async uploadOriginalFile(filePath, remoteName, mimeType, options = {}) {
        const uploadId = this._generateUploadId();
        this._log('info', 'Starting MinIO upload', { uploadId, filePath, remoteName, mimeType });
        console.log(`[MinIO] Starting upload: ${filePath} -> ${remoteName} (${mimeType})`);

        try {
            const validation = this.validateConfiguration();
            if (!validation.valid) {
                return {
                    success: false,
                    message: `Configuration invalid: ${validation.errors.join(', ')}`
                };
            }

            // Validate file
            const fileInfo = await this._validateFilePath(filePath);
            if (!fileInfo.exists) {
                return {
                    success: false,
                    message: `File not found: ${filePath}`
                };
            }

            if (!fileInfo.isFile) {
                return {
                    success: false,
                    message: `Path is not a file: ${filePath}`
                };
            }

            // Check for duplicates and generate unique name if needed
            let finalRemoteName = remoteName;
            if (options.skipDuplicates) {
                const isDuplicate = await this.checkIfDuplicate(remoteName, fileInfo.size);
                if (isDuplicate) {
                    this._log('info', 'MinIO skipping duplicate file', { remoteName, fileSize: fileInfo.size });
                    return {
                        success: true,
                        message: 'File skipped (duplicate)',
                        url: `${this.getMinioEndpoint()}/${this.settings.bucket}/${remoteName}`,
                        skipped: true
                    };
                }
            } else {
                finalRemoteName = await this.generateUniqueRemoteName(remoteName, fileInfo.size);
            }

            // Read file content
            const fileContent = await this._readFile(filePath);

            // Import AWS SDK
            const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

            // Create S3 client configured for MinIO
            const s3Client = new S3Client({
                endpoint: this.getMinioEndpoint(),
                region: this.settings.region || 'us-east-1',
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                },
                forcePathStyle: true,
                tls: this.settings.useSSL !== false
            });

            // Track upload progress
            this.activeUploads.set(uploadId, {
                status: 'uploading',
                progress: 0,
                remoteName: finalRemoteName,
                fileSize: fileInfo.size,
                startTime: Date.now()
            });

            // Upload file
            const putCommand = new PutObjectCommand({
                Bucket: this.settings.bucket,
                Key: finalRemoteName,
                Body: fileContent,
                ContentType: mimeType || 'application/octet-stream'
            });

            const startTime = Date.now();
            const response = await s3Client.send(putCommand);
            const uploadTime = Date.now() - startTime;

            // Update progress
            this._updateProgress(uploadId, 100, 'completed');

            // Generate public URL
            const publicUrl = `${this.getMinioEndpoint()}/${this.settings.bucket}/${finalRemoteName}`;

            this._log('info', 'MinIO upload completed', {
                uploadId,
                finalRemoteName,
                fileSize: fileInfo.size,
                uploadTime,
                etag: response.ETag
            });

            console.log(`[MinIO] Upload completed successfully: ${finalRemoteName} (${fileInfo.size} bytes, ${uploadTime}ms)`);
            console.log(`[MinIO] File URL: ${publicUrl}`);
            console.log(`[MinIO] ETag: ${response.ETag}`);

            // Clean up
            this.activeUploads.delete(uploadId);

            return {
                success: true,
                message: 'File uploaded successfully',
                url: publicUrl,
                details: {
                    uploadId,
                    remoteName: finalRemoteName,
                    fileSize: fileInfo.size,
                    uploadTime,
                    etag: response.ETag
                }
            };

        } catch (error) {
            this._log('error', 'MinIO upload failed', { 
                uploadId, 
                error: error.message,
                stack: error.stack
            });

            console.error(`[MinIO] Upload failed: ${error.message}`);
            console.error(`[MinIO] Upload ID: ${uploadId}`);
            console.error(`[MinIO] File: ${filePath}`);
            console.error(`[MinIO] Remote name: ${remoteName}`);
            console.error(`[MinIO] Error details:`, error);

            // Update progress
            this._updateProgress(uploadId, 0, 'failed');

            // Clean up
            this.activeUploads.delete(uploadId);

            return {
                success: false,
                message: `Upload failed: ${error.message}`,
                details: { uploadId, error: error.message }
            };
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
            remoteName: upload.remoteName,
            fileSize: upload.fileSize,
            startTime: upload.startTime
        };
    }

    async cancelUpload(uploadId) {
        const upload = this.activeUploads.get(uploadId);
        if (!upload) {
            return false;
        }

        // Update status
        upload.status = 'cancelled';
        this.activeUploads.delete(uploadId);

        this._log('info', 'MinIO upload cancelled', { uploadId });
        return true;
    }

    sanitizeSettings(settings) {
        const sanitized = { ...settings };
        
        // Remove sensitive fields
        if (sanitized.accessKey) {
            sanitized.accessKey = '[REDACTED]';
        }
        if (sanitized.secretKey) {
            sanitized.secretKey = '[REDACTED]';
        }
        
        return sanitized;
    }

    /**
     * Get MinIO endpoint URL
     * @returns {string} MinIO endpoint URL
     */
    getMinioEndpoint() {
        const protocol = this.settings.useSSL !== false ? 'https' : 'http';
        const port = this.settings.port || (this.settings.useSSL !== false ? 443 : 80);
        const portSuffix = (port === 443 && this.settings.useSSL !== false) || (port === 80 && this.settings.useSSL === false) ? '' : `:${port}`;
        
        return `${protocol}://${this.settings.endpoint}${portSuffix}`;
    }

    /**
     * List files in a given path
     * @param {string} path - Path to list files from (empty string for root)
     * @returns {Promise<Object>} List result with files array
     */
    async listFiles(path = '') {
        this._log('info', 'Listing files in MinIO', { path });
        
        try {
            // Validate configuration
            if (!this.isServiceConfigured()) {
                throw new Error('Service not properly configured');
            }

            // Import AWS SDK
            const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

            // Create S3 client configured for MinIO
            const s3Client = new S3Client({
                endpoint: this.getMinioEndpoint(),
                region: this.settings.region || 'us-east-1',
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                },
                forcePathStyle: true,
                tls: this.settings.useSSL !== false
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

            this._log('info', 'MinIO file listing completed', { path, fileCount: files.length });
            
            return {
                success: true,
                files: files,
                message: `Listed ${files.length} files/directories`,
                details: {
                    path,
                    bucket: this.settings.bucket,
                    endpoint: this.settings.endpoint
                }
            };

        } catch (error) {
            this._log('error', 'MinIO file listing failed', { error: error.message, path });
            return {
                success: false,
                files: [],
                message: `Failed to list files: ${error.message}`,
                details: { error: error.message, path }
            };
        }
    }

    /**
     * Download a file from MinIO
     * @param {string} filename - Name of the file to download
     * @param {string} localPath - Local path to save the file
     * @returns {Promise<Object>} Download result
     */
    async downloadFile(filename, localPath) {
        this._log('info', 'Downloading file from MinIO', { filename, localPath });
        
        try {
            // Validate configuration
            if (!this.isServiceConfigured()) {
                throw new Error('Service not properly configured');
            }

            // Import AWS SDK
            const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
            const fs = require('fs').promises;
            const path = require('path');

            // Create S3 client configured for MinIO
            const s3Client = new S3Client({
                endpoint: this.getMinioEndpoint(),
                region: this.settings.region || 'us-east-1',
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                },
                forcePathStyle: true,
                tls: this.settings.useSSL !== false
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

            this._log('info', 'MinIO file download completed', { filename, localPath, size: fileBuffer.length });
            
            return {
                success: true,
                localPath: localPath,
                message: 'File downloaded successfully',
                details: {
                    filename,
                    localPath,
                    size: fileBuffer.length,
                    bucket: this.settings.bucket,
                    endpoint: this.settings.endpoint
                }
            };

        } catch (error) {
            this._log('error', 'MinIO file download failed', { error: error.message, filename });
            return {
                success: false,
                message: `Failed to download file: ${error.message}`,
                details: { error: error.message, filename, localPath }
            };
        }
    }

    /**
     * Create a shareable URL with expiration for MinIO
     * @param {string} filename - Name of the file to create URL for
     * @param {Date|number} expiresAt - Expiration date or timestamp
     * @returns {Promise<Object>} URL result
     */
    async createShareableUrl(filename, expiresAt) {
        this._log('info', 'Creating shareable URL for MinIO', { filename, expiresAt });
        
        try {
            // Validate configuration
            if (!this.isServiceConfigured()) {
                throw new Error('Service not properly configured');
            }

            // Import AWS SDK
            const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
            const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

            // Create S3 client configured for MinIO
            const s3Client = new S3Client({
                endpoint: this.getMinioEndpoint(),
                region: this.settings.region || 'us-east-1',
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                },
                forcePathStyle: true,
                tls: this.settings.useSSL !== false
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

            this._log('info', 'MinIO shareable URL created', { filename, expiresAt: expirationDate });
            
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
                    endpoint: this.settings.endpoint
                }
            };

        } catch (error) {
            this._log('error', 'MinIO shareable URL creation failed', { error: error.message, filename });
            return {
                success: false,
                message: `Failed to create shareable URL: ${error.message}`,
                details: { error: error.message, filename, expiresAt }
            };
        }
    }

    /**
     * Update upload progress
     * @param {string} uploadId - Upload identifier
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} status - Upload status
     * @private
     */
    _updateProgress(uploadId, progress, status) {
        const upload = this.activeUploads.get(uploadId);
        if (upload) {
            upload.progress = progress;
            upload.status = status;
            
            this._log('info', 'MinIO upload progress updated', {
                uploadId,
                progress,
                status,
                remoteName: upload.remoteName
            });
        }
    }
}

module.exports = { MinioService }; 