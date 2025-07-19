/**
 * Generic S3 Upload Service
 * 
 * This shoudl work with AWS, GenericS3, Hetzner, OVH, Cloudflare (and more?)
 * 
 * We're assuming we have list permissions, and our test also tries a delete
 * to remove a test file, but fails silently if it cannot perform the delete
 * 
 * Without list we cannot properly check for duplicates
 * 
 */

const { StorageServiceBase } = require('./StorageServiceBase.js');
const { S3Client, HeadBucketCommand, ListObjectsV2Command, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const fs = require('fs').promises;
const path = require('path');

class GenericS3Service extends StorageServiceBase {
    constructor(settings = {}) {
        super(settings);

        if (this.constructor === GenericS3Service) {
            throw new Error('GenericS3Service is abstract and cannot be instantiated directly');
        }
    }

    getServiceName() {
        throw new Error('getServiceName() must be implemented by subclass');
    }

    getEndpoint() {
        const protocol = this.settings.useSSL !== false ? 'https' : 'http';
        const port = this.settings.port || (this.settings.useSSL !== false ? 443 : 80);
        const portSuffix = (port === 443 && this.settings.useSSL !== false) || (port === 80 && this.settings.useSSL === false) ? '' : `:${port}`;
        
        return `${protocol}://${this.settings.endpoint}${portSuffix}`;
    }

    validateConfiguration() {
        const errors = [];
        
        if (!this.settings.endpoint) {
            errors.push('Endpoint is required');
        }
        
        if (!this.settings.bucket) {
            errors.push('Bucket name is required');
        }
        
        if (!this.settings.accessKey) {
            errors.push('Access key is required');
        }
        
        if (!this.settings.secretKey) {
            errors.push('Secret key is required');
        }

        // Validate formats
        if (this.settings.endpoint && !this.settings.endpoint.match(/^[a-zA-Z0-9.-]+$/)) {
            errors.push('Invalid endpoint format');
        }

        if (this.settings.bucket && !this.settings.bucket.match(/^[a-z0-9.-]+$/)) {
            errors.push('Invalid bucket name format');
        }

        if (this.settings.port && (!Number.isInteger(this.settings.port) || this.settings.port < 1 || this.settings.port > 65535)) {
            errors.push('Port must be a valid port number (1-65535)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async testConnection() {
        this._log('info', `Testing ${this.getServiceName()} connection`);
        
        try {
            const validation = this.validateConfiguration();
            if (!validation.valid) {
                this._log('error', `Connection test failed, invalid configuration.`);
                return false;
            }

            // Create S3 client
            const s3Client = new S3Client({
                endpoint: this.getEndpoint(),
                region: this.settings.region || 'us-east-1',
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                },
                forcePathStyle: true,
                tls: this.settings.useSSL !== false // Default to true
            });

            // Test 1: Check if bucket exists and we have access to it
            try {

                const headBucketCommand = new HeadBucketCommand({
                    Bucket: this.settings.bucket
                });

                const headBucketResponse = await s3Client.send(headBucketCommand);
                this._log('info', 'Bucket head request successful');

            } catch (error) {
                
                this._log('error', 'Bucket head request failed', { error: error.message, code: error.name });
                
                if (error.name === 'NotFound' || error.name === 'NoSuchBucket') {
                    this._log('error', `Bucket '${this.settings.bucket}' does not exist or is not accessible`);
                    
                } else if (error.name === 'Forbidden' || error.name === 'AccessDenied') {
                    this._log('error', 'Access denied to bucket. Check your credentials and permissions.');
                } else if (error.name === 'NetworkingError' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                    this._log('error', `Cannot connect to ${this.getServiceName()} server at ${this.settings.endpoint}:${this.settings.port}. Check endpoint and network connectivity.`);
                } else {
                    this._log('error', `Connection failed: ${error.message}`);
                }

                return false;
            }


            // Test 2: Try to list objects to verify read access
            try {

                const listCommand = new ListObjectsV2Command({
                    Bucket: this.settings.bucket,
                    MaxKeys: 1
                });

                const listResponse = await s3Client.send(listCommand);
                this._log('info', 'GenericS3 list objects successful', { 
                    keyCount: listResponse.KeyCount || 0
                });

            } catch (error) {

                this._log('warn', 'GenericS3 list objects failed (bucket might be empty or no list permission)', { 
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
                this._log('info', 'Test upload successful');
                
                // Clean up test file
                try {

                    const deleteCommand = new DeleteObjectCommand({
                        Bucket: this.settings.bucket,
                        Key: testKey
                    });

                    await s3Client.send(deleteCommand);
                    this._log('info', 'Test file cleanup successful');

                } catch (deleteError) {

                    this._log('warn', 'Test file cleanup failed', { error: deleteError.message });

                }
                
            } catch (error) {

                this._log('error', 'Test upload failed', { error: error.message });
                return false;
                
            }

            return true;

        } catch (error) {

            this._log('error', 'Connection test failed', { error: error.message });
            return false;

        }
    }

    async checkIfDuplicate(remoteName, expectedSize) {
        try {

            const s3Client = new S3Client({
                endpoint: this.getEndpoint(),
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
            
            /* this._log('info', 'Duplicate check completed', {
                remoteName,
                expectedSize,
                existingSize,
                isDuplicate
            }); */
            
            return {
                exists: existingSize > 0,
                isDuplicate
            };
            
        } catch (error) {

            return {
                exists: false,
                isDuplicate: false
            };

        }
    }

    async uploadOriginalFile(filePath, remoteName, mimeType, options = {}) {
        this._log('info', `Starting upload of ${filePath} to ${remoteName} (${mimeType})`);

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
                const dupeCheck = await this.checkIfDuplicate(remoteName, fileInfo.size);
                if ( dupeCheck.isDuplicate ) {
                    this._log('info', 'GenericS3 skipping duplicate file', { remoteName, fileSize: fileInfo.size });

                    return {
                        success: true,
                        url: `${this.getEndpoint()}/${this.settings.bucket}/${remoteName}`,
                        skipped: true
                    };

                }
            } else {

                finalRemoteName = await this.generateUniqueRemoteName(remoteName);

            }

            // Read file content
            this._emitProgress(1, fileInfo.size);
            const fileContent = await this._readFile(filePath);

            // Create S3 client configured for GenericS3
            const s3Client = new S3Client({
                endpoint: this.getEndpoint(),
                region: this.settings.region || 'us-east-1',
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                },
                forcePathStyle: true,
                tls: this.settings.useSSL !== false
            });

            // Upload file
            this._emitProgress(2, fileInfo.size);
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
            this._emitProgress(fileInfo.size, fileInfo.size);

            // Generate public URL
            const publicUrl = `${this.getEndpoint()}/${this.settings.bucket}/${finalRemoteName}`;

            this._log('info', `GenericS3 upload completed of ${finalRemoteName} (${fileInfo.size} bytes, ${uploadTime}ms)`);

            //console.log(`[GenericS3] Upload completed successfully: ${finalRemoteName} (${fileInfo.size} bytes, ${uploadTime}ms)`);
            //console.log(`[GenericS3] File URL: ${publicUrl}`);
            //console.log(`[GenericS3] ETag: ${response.ETag}`);

            return {
                success: true,
                url: publicUrl
            };

        } catch (error) {
            this._log('error', 'GenericS3 upload failed', { 
                error: error.message,
                stack: error.stack
            });

            console.error(`[GenericS3] Upload failed: ${error.message}`);
            console.error(`[GenericS3] File: ${filePath}`);
            console.error(`[GenericS3] Remote name: ${remoteName}`);
            console.error(`[GenericS3] Error details:`, error);

            return {
                success: false,
                message: `Upload failed: ${error.message}`
            };
        }
    }

    /**
     * List files in a given path
     * @param {string} path - Path to list files from (empty string for root)
     * @returns {Promise<Object>} List result with files array
     */
    async listFiles(path = '') {
        this._log('info', 'Listing files in GenericS3', { path });
        
        try {
            // Validate configuration
            if (!this.validateConfiguration()) {
                throw new Error('Service not properly configured');
            }

            // Import AWS SDK
            const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

            // Create S3 client configured for GenericS3
            const s3Client = new S3Client({
                endpoint: this.getEndpoint(),
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

            this._log('info', 'GenericS3 file listing completed', { path, fileCount: files.length });
            
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
            this._log('error', 'GenericS3 file listing failed', { error: error.message, path });
            return {
                success: false,
                files: [],
                message: `Failed to list files: ${error.message}`,
                details: { error: error.message, path }
            };
        }
    }
    
    async downloadFile(filename, localPath) {
        this._log('info', 'Downloading file from GenericS3', { filename, localPath });
        
        try {
            // Validate configuration
            if (!this.validateConfiguration()) {
                throw new Error('Service not properly configured');
            }

            // Create S3 client configured for GenericS3
            const s3Client = new S3Client({
                endpoint: this.getEndpoint(),
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

            this._log('info', 'GenericS3 file download completed', { filename, localPath, size: fileBuffer.length });
            return true;

        } catch (error) {
            this._log('error', 'GenericS3 file download failed', { error: error.message, filename });
            return false;
        }
    }
    
    async createShareableUrl(filename, expiresAt) {
        this._log('info', 'Creating shareable URL for GenericS3', { filename, expiresAt });
        
        // Validate configuration
        if (!this.validateConfiguration()) {
            throw new Error('Service not properly configured');
        }

        // Create S3 client configured for GenericS3
        const s3Client = new S3Client({
            endpoint: this.getEndpoint(),
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

        this._log('info', 'GenericS3 shareable URL created', { filename, expiresAt: expirationDate });
        return presignedUrl;
    }
}

module.exports = { GenericS3Service }; 