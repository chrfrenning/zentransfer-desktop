/**
 * AWS S3 Upload Service
 * Handles uploads to Amazon S3
 */

const { UploadServiceBase } = require('./upload-service-base.js');

class AwsS3Service extends UploadServiceBase {
    constructor(settings = {}) {
        super(settings);
        this.activeUploads = new Map();
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
                const result = {
                    success: false,
                    message: `Configuration invalid: ${validation.errors.join(', ')}`
                };
                this._storeTestResult(result);
                return result;
            }

            // Import AWS SDK
            const { S3Client, HeadBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

            // Create S3 client with credentials
            const s3Client = new S3Client({
                region: this.settings.region,
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                }
            });

            this._log('info', 'Testing bucket access with AWS SDK', { 
                region: this.settings.region,
                bucket: this.settings.bucket,
                accessKeyId: this.settings.accessKey.substring(0, 8) + '...[REDACTED]'
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
                    const result = {
                        success: false,
                        message: `Bucket '${this.settings.bucket}' does not exist in region '${this.settings.region}'`,
                        details: {
                            region: this.settings.region,
                            bucket: this.settings.bucket,
                            error: 'NoSuchBucket',
                            suggestion: 'Verify the bucket name and region are correct'
                        }
                    };
                    this._storeTestResult(result);
                    return result;
                } else if (headError.name === 'Forbidden' || headError.$metadata?.httpStatusCode === 403) {
                    const result = {
                        success: false,
                        message: `Access denied to bucket '${this.settings.bucket}'. Check your AWS credentials and bucket permissions.`,
                        details: {
                            region: this.settings.region,
                            bucket: this.settings.bucket,
                            error: 'Forbidden',
                            suggestion: 'Verify your AWS access key, secret key, and bucket permissions'
                        }
                    };
                    this._storeTestResult(result);
                    return result;
                } else if (headError.name === 'InvalidAccessKeyId') {
                    const result = {
                        success: false,
                        message: 'Invalid AWS access key ID',
                        details: {
                            error: 'InvalidAccessKeyId',
                            suggestion: 'Check your AWS access key ID'
                        }
                    };
                    this._storeTestResult(result);
                    return result;
                } else if (headError.name === 'SignatureDoesNotMatch') {
                    const result = {
                        success: false,
                        message: 'Invalid AWS secret access key',
                        details: {
                            error: 'SignatureDoesNotMatch',
                            suggestion: 'Check your AWS secret access key'
                        }
                    };
                    this._storeTestResult(result);
                    return result;
                } else {
                    // Re-throw unexpected errors to be caught by outer catch block
                    throw headError;
                }
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

            const result = {
                success: true,
                message: hasListPermission 
                    ? `AWS S3 connection successful - found ${objectCount} objects in bucket` 
                    : 'AWS S3 connection successful - bucket accessible but cannot list objects',
                details: {
                    region: this.settings.region,
                    bucket: this.settings.bucket,
                    bucketLocation: bucketLocation,
                    objectCount: hasListPermission ? objectCount : 'unknown',
                    hasListPermission: hasListPermission,
                    storageClass: this.settings.storageClass || 'STANDARD',
                    credentialsValid: true,
                    bucketAccessible: true
                }
            };
            
            this._storeTestResult(result);
            this._log('info', 'AWS S3 connection test completed successfully');
            return result;

        } catch (error) {
            const result = {
                success: false,
                message: `AWS S3 connection failed: ${error.message}`,
                details: { 
                    error: error.message,
                    errorName: error.name,
                    region: this.settings.region,
                    bucket: this.settings.bucket
                }
            };
            
            this._storeTestResult(result);
            this._log('error', 'AWS S3 connection test failed', { error: error.message, errorName: error.name });
            return result;
        }
    }

    /**
     * Check if a file exists in S3 and is a duplicate
     * @param {string} remoteName - The remote file name/key
     * @param {number} expectedSize - Expected file size for duplicate comparison
     * @returns {Promise<boolean>} True if file exists and is a duplicate
     */
    async checkIfDuplicate(remoteName, expectedSize) {
        try {
            // Import AWS SDK
            const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

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
                return true;
            }
            
            return false;
        } catch (error) {
            if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
                // File doesn't exist, not a duplicate
                return false;
            }
            
            // Other errors (permissions, network, etc.) - assume not duplicate to be safe
            this._log('warn', 'Error checking S3 duplicate', { error: error.message, remoteName });
            return false;
        }
    }

    /**
     * Generate a unique filename if the original already exists
     * @param {string} originalRemoteName - Original remote file name/key
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
        
        this._log('info', 'Generated unique filename for S3 upload', { 
            original: originalRemoteName, 
            unique: uniqueName 
        });
        
        return uniqueName;
    }

    async uploadFile(filePath, remoteName, mimeType, options = {}) {
        this._log('info', 'Starting AWS S3 upload', { remoteName, mimeType });
        
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
                    this._log('info', 'Skipping duplicate file upload to S3', { remoteName, size: fileInfo.size });
                    
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
                        message: 'File skipped - duplicate already exists in S3',
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
                    this._log('info', 'Using unique filename for S3 upload', { 
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

            this._updateProgress(uploadId, 10, 'Initializing S3 upload...');

            // Import AWS SDK
            const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

            // Create S3 client
            const s3Client = new S3Client({
                region: this.settings.region,
                credentials: {
                    accessKeyId: this.settings.accessKey,
                    secretAccessKey: this.settings.secretKey
                }
            });

            this._updateProgress(uploadId, 20, 'Uploading to S3...');

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
            const command = new PutObjectCommand(uploadParams);
            const response = await s3Client.send(command);

            this._updateProgress(uploadId, 90, 'Upload completed');

            // Construct the S3 URL with final remote name
            const s3Url = `https://${this.settings.bucket}.s3.${this.settings.region}.amazonaws.com/${finalRemoteName}`;
            
            // Update upload status
            this.activeUploads.set(uploadId, {
                status: 'completed',
                progress: 100,
                startTime: this.activeUploads.get(uploadId).startTime,
                endTime: Date.now()
            });

            const uploadResult = {
                success: true,
                url: s3Url,
                message: 'File uploaded successfully to AWS S3',
                details: {
                    uploadId,
                    size: fileInfo.size,
                    remoteName: finalRemoteName, // Use final name in response
                    originalRemoteName: remoteName, // Include original name for reference
                    mimeType,
                    bucket: this.settings.bucket,
                    region: this.settings.region,
                    storageClass: this.settings.storageClass || 'STANDARD',
                    etag: response.ETag,
                    wasRenamed: finalRemoteName !== remoteName
                }
            };

            this._log('info', 'AWS S3 upload completed', uploadResult.details);
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
                message: `AWS S3 upload failed: ${error.message}`,
                details: { error: error.message, filePath, remoteName }
            };

            this._log('error', 'AWS S3 upload failed', uploadResult.details);
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

        this._log('info', 'AWS S3 upload cancelled', { uploadId });
        return true;
    }

    sanitizeSettings(settings) {
        const sanitized = super.sanitizeSettings(settings);
        
        // AWS-specific sensitive fields
        if (sanitized.accessKey) {
            sanitized.accessKey = sanitized.accessKey.substring(0, 8) + '...[REDACTED]';
        }
        
        return sanitized;
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

module.exports = { AwsS3Service }; 