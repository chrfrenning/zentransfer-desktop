/**
 * GCP Cloud Storage Upload Service
 * Handles uploads to Google Cloud Storage
 */

const { EnhancedUploadServiceBase } = require('./enhanced-upload-service-base.js');

class GcpStorageService extends EnhancedUploadServiceBase {
    constructor(settings = {}) {
        super(settings);
        this.activeUploads = new Map();
        this.serviceAccountData = null;
    }

    getServiceName() {
        return 'GCP Cloud Storage';
    }

    validateConfiguration() {
        const errors = [];
        
        if (!this.settings.serviceAccountKey) {
            errors.push('GCP service account key is required');
        }
        
        if (!this.settings.bucketName) {
            errors.push('GCS bucket name is required');
        }

        // Parse and validate service account key
        if (this.settings.serviceAccountKey) {
            try {
                // Debug: Log the type and first few characters of the service account key
                this._log('debug', 'Service account key type and preview', {
                    type: typeof this.settings.serviceAccountKey,
                    preview: this.settings.serviceAccountKey.substring(0, 50) + '...',
                    length: this.settings.serviceAccountKey.length
                });
                
                this.serviceAccountData = JSON.parse(this.settings.serviceAccountKey);
                
                const requiredFields = [
                    'type', 'project_id', 'private_key_id', 'private_key', 
                    'client_email', 'client_id', 'universe_domain'
                ];
                
                const missingFields = requiredFields.filter(field => !this.serviceAccountData[field]);
                if (missingFields.length > 0) {
                    errors.push(`Service account key missing required fields: ${missingFields.join(', ')}`);
                }

                // Validate service account type
                if (this.serviceAccountData.type !== 'service_account') {
                    errors.push('Invalid service account key type - must be "service_account"');
                }

                // Validate email format
                const emailPattern = /^[^@]+@[^@]+\.iam\.gserviceaccount\.com$/;
                if (this.serviceAccountData.client_email && 
                    !emailPattern.test(this.serviceAccountData.client_email)) {
                    errors.push('Invalid service account email format');
                }

                // Validate private key format
                if (this.serviceAccountData.private_key && 
                    (!this.serviceAccountData.private_key.includes('BEGIN PRIVATE KEY') || 
                     !this.serviceAccountData.private_key.includes('END PRIVATE KEY'))) {
                    errors.push('Invalid private key format in service account key');
                }

                // Validate project ID format
                const validProjectPattern = /^[a-z][a-z0-9-]*[a-z0-9]$/;
                if (this.serviceAccountData.project_id && 
                    !validProjectPattern.test(this.serviceAccountData.project_id)) {
                    errors.push('Invalid GCP project ID format');
                }
            } catch (error) {
                errors.push('Invalid JSON in service account key');
            }
        }

        // Validate bucket name format
        if (this.settings.bucketName && 
            !this.settings.bucketName.match(/^[a-z0-9._-]{3,63}$/)) {
            errors.push('Invalid GCS bucket name format');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async testConnection() {
        this._log('info', 'Testing GCP Cloud Storage connection');
        
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

            // Ensure service account data is parsed
            if (!this.serviceAccountData) {
                this.serviceAccountData = JSON.parse(this.settings.serviceAccountKey);
            }

            this._log('info', 'Using service account', { 
                email: this.serviceAccountData.client_email,
                projectId: this.serviceAccountData.project_id,
                bucketName: this.settings.bucketName
            });

            // Import Google Cloud Storage SDK
            const { Storage } = require('@google-cloud/storage');

            // Create storage client with service account credentials
            const storage = new Storage({
                credentials: this.serviceAccountData,
                projectId: this.serviceAccountData.project_id
            });

            // Get bucket reference
            console.log(this.settings.bucketName);
            const bucket = storage.bucket(this.settings.bucketName);

            // Test bucket access by listing objects (this verifies both connectivity and permissions)
            let objectCount = 0;
            let hasListPermission = true;
            
            try {
                const [files] = await bucket.getFiles({ maxResults: 10 }); // Limit to 10 files for testing
                objectCount = files.length;
                this._log('info', 'Successfully listed bucket objects', { 
                    objectCount,
                    sampleFiles: files.slice(0, 3).map(f => f.name)
                });
            } catch (listError) {
                // If we can't list objects, the bucket might not exist or we don't have permission
                hasListPermission = false;
                this._log('warn', 'Could not list bucket objects', { error: listError.message });
                
                // Return more specific error message
                const result = {
                    success: false,
                    message: `Cannot access bucket '${this.settings.bucketName}': ${listError.message}`,
                    details: {
                        projectId: this.serviceAccountData.project_id,
                        bucketName: this.settings.bucketName,
                        serviceAccount: this.serviceAccountData.client_email,
                        error: listError.message
                    }
                };
                this._storeTestResult(result);
                return result;
            }

            // Try to get bucket metadata for additional info (optional)
            let metadata = null;
            try {
                [metadata] = await bucket.getMetadata();
            } catch (metadataError) {
                this._log('warn', 'Could not get bucket metadata, but can list objects', { error: metadataError.message });
            }

            const result = {
                success: true,
                message: `GCP Cloud Storage connection successful - found ${objectCount} objects in bucket`,
                details: {
                    projectId: this.serviceAccountData.project_id,
                    bucketName: this.settings.bucketName,
                    serviceAccount: this.serviceAccountData.client_email,
                    location: metadata?.location || 'unknown',
                    storageClass: metadata?.storageClass || 'unknown',
                    objectCount: objectCount,
                    hasListPermission: hasListPermission
                }
            };
            
            this._storeTestResult(result);
            this._log('info', 'GCP Cloud Storage connection test completed');
            return result;

        } catch (error) {
            const result = {
                success: false,
                message: `GCP Cloud Storage connection failed: ${error.message}`,
                details: { error: error.message }
            };
            
            this._storeTestResult(result);
            this._log('error', 'GCP Cloud Storage connection test failed', { error: error.message });
            return result;
        }
    }

    /**
     * Check if a file exists in GCP Cloud Storage and is a duplicate
     * @param {string} remoteName - The remote file name
     * @param {number} expectedSize - Expected file size for duplicate comparison
     * @returns {Promise<boolean>} True if file exists and is a duplicate
     */
    async checkIfDuplicate(remoteName, expectedSize) {
        try {
            // Ensure service account data is parsed
            if (!this.serviceAccountData) {
                this.serviceAccountData = JSON.parse(this.settings.serviceAccountKey);
            }

            // Import Google Cloud Storage SDK
            const { Storage } = require('@google-cloud/storage');

            // Create storage client with service account credentials
            const storage = new Storage({
                credentials: this.serviceAccountData,
                projectId: this.serviceAccountData.project_id
            });

            // Get bucket and file references
            const bucket = storage.bucket(this.settings.bucketName);
            const file = bucket.file(remoteName);

            // Check if file exists
            const [exists] = await file.exists();
            if (!exists) {
                return false;
            }

            // Get file metadata to check size
            const [metadata] = await file.getMetadata();
            
            // Check if file sizes match (basic duplicate detection)
            if (parseInt(metadata.size) === expectedSize) {
                this._log('info', 'Duplicate file detected in GCP', { 
                    remoteName, 
                    expectedSize, 
                    actualSize: parseInt(metadata.size) 
                });
                return true;
            }
            
            return false;
        } catch (error) {
            // Any errors (permissions, network, etc.) - assume not duplicate to be safe
            this._log('warn', 'Error checking GCP duplicate', { error: error.message, remoteName });
            return false;
        }
    }

    /**
     * Generate a unique filename if the original already exists
     * @param {string} originalRemoteName - Original remote file name
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
        
        this._log('info', 'Generated unique filename for GCP upload', { 
            original: originalRemoteName, 
            unique: uniqueName 
        });
        
        return uniqueName;
    }

    async uploadOriginalFile(filePath, remoteName, mimeType, options = {}) {
        this._log('info', 'Starting GCP Cloud Storage upload', { remoteName, mimeType });
        
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
                    this._log('info', 'Skipping duplicate file upload to GCP', { remoteName, size: fileInfo.size });
                    
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
                        message: 'File skipped - duplicate already exists in GCP Cloud Storage',
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
                    this._log('info', 'Using unique filename for GCP upload', { 
                        original: remoteName, 
                        unique: finalRemoteName 
                    });
                }
            }

            // Track upload
            this.activeUploads.set(uploadId, {
                status: 'uploading',
                progress: 0,
                startTime: Date.now()
            });

            this._updateProgress(uploadId, 10, 'Initializing GCP upload...');

            // Ensure service account data is parsed
            if (!this.serviceAccountData) {
                this.serviceAccountData = JSON.parse(this.settings.serviceAccountKey);
            }

            // Import Google Cloud Storage SDK
            const { Storage } = require('@google-cloud/storage');

            // Create storage client with service account credentials
            const storage = new Storage({
                credentials: this.serviceAccountData,
                projectId: this.serviceAccountData.project_id
            });

            // Get bucket and file references with final remote name
            const bucket = storage.bucket(this.settings.bucketName);
            const file = bucket.file(finalRemoteName);

            this._updateProgress(uploadId, 20, 'Uploading to GCP...');

            // Read file content
            const fileContent = await this._readFile(filePath);

            // Set upload options
            const uploadOptions = {
                metadata: {
                    contentType: mimeType,
                    metadata: options.metadata || {}
                },
                resumable: fileInfo.size > 5 * 1024 * 1024, // Use resumable upload for files > 5MB
                validation: 'crc32c'
            };

            // Upload the file
            await file.save(fileContent, uploadOptions);

            this._updateProgress(uploadId, 90, 'Upload completed');

            // Make the file publicly accessible if needed (optional)
            // await file.makePublic();

            // Construct the GCS URL with final remote name
            const gcsUrl = `https://storage.googleapis.com/${this.settings.bucketName}/${finalRemoteName}`;
            
            // Update upload status
            this.activeUploads.set(uploadId, {
                status: 'completed',
                progress: 100,
                startTime: this.activeUploads.get(uploadId).startTime,
                endTime: Date.now()
            });

            const uploadResult = {
                success: true,
                url: gcsUrl,
                message: 'File uploaded successfully to GCP Cloud Storage',
                details: {
                    uploadId,
                    size: fileInfo.size,
                    remoteName: finalRemoteName, // Use final name in response
                    originalRemoteName: remoteName, // Include original name for reference
                    mimeType,
                    bucketName: this.settings.bucketName,
                    projectId: this.serviceAccountData.project_id,
                    generation: file.metadata?.generation,
                    etag: file.metadata?.etag,
                    wasRenamed: finalRemoteName !== remoteName
                }
            };

            this._log('info', 'GCP Cloud Storage upload completed', uploadResult.details);
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
                message: `GCP Cloud Storage upload failed: ${error.message}`,
                details: { error: error.message, filePath, remoteName }
            };

            this._log('error', 'GCP Cloud Storage upload failed', uploadResult.details);
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

        this._log('info', 'GCP Cloud Storage upload cancelled', { uploadId });
        return true;
    }

    sanitizeSettings(settings) {
        const sanitized = super.sanitizeSettings(settings);
        
        // GCP-specific sensitive fields
        if (sanitized.serviceAccountKey) {
            try {
                const keyData = JSON.parse(settings.serviceAccountKey);
                const sanitizedKey = {
                    type: keyData.type,
                    project_id: keyData.project_id,
                    client_email: keyData.client_email,
                    client_id: keyData.client_id,
                    universe_domain: keyData.universe_domain,
                    private_key_id: '[REDACTED]',
                    private_key: '[REDACTED]'
                };
                sanitized.serviceAccountKey = JSON.stringify(sanitizedKey, null, 2);
            } catch (error) {
                sanitized.serviceAccountKey = '[INVALID JSON]';
            }
        }
        
        return sanitized;
    }

    /**
     * Get the GCS endpoint URL for the configured bucket
     * @returns {string} GCS endpoint URL
     */
    getEndpointUrl() {
        return `https://storage.googleapis.com/${this.settings.bucketName}/`;
    }

    /**
     * Get the project ID from the service account key
     * @returns {string|null} Project ID or null if not configured
     */
    getProjectId() {
        if (!this.serviceAccountData) {
            try {
                this.serviceAccountData = JSON.parse(this.settings.serviceAccountKey);
            } catch (error) {
                return null;
            }
        }
        return this.serviceAccountData?.project_id || null;
    }

    /**
     * Get the service account email from the service account key
     * @returns {string|null} Service account email or null if not configured
     */
    getServiceAccountEmail() {
        if (!this.serviceAccountData) {
            try {
                this.serviceAccountData = JSON.parse(this.settings.serviceAccountKey);
            } catch (error) {
                return null;
            }
        }
        return this.serviceAccountData?.client_email || null;
    }

    /**
     * List files in a given path
     * @param {string} path - Path to list files from (empty string for root)
     * @returns {Promise<Object>} List result with files array
     */
    async listFiles(path = '') {
        this._log('info', 'Listing files in GCP Cloud Storage', { path });
        
        try {
            // Validate configuration
            if (!this.isServiceConfigured()) {
                throw new Error('Service not properly configured');
            }

            // Ensure service account data is parsed
            if (!this.serviceAccountData) {
                this.serviceAccountData = JSON.parse(this.settings.serviceAccountKey);
            }

            // Import Google Cloud Storage SDK
            const { Storage } = require('@google-cloud/storage');

            // Create storage client
            const storage = new Storage({
                credentials: this.serviceAccountData,
                projectId: this.serviceAccountData.project_id
            });

            const bucket = storage.bucket(this.settings.bucketName);
            const files = [];

            // List files with prefix
            const [gcsFiles] = await bucket.getFiles({
                prefix: path,
                delimiter: '/'
            });

            // Process files
            gcsFiles.forEach(file => {
                // Skip the path itself if it's a directory marker
                if (file.name !== path && file.name !== path + '/') {
                    files.push({
                        name: file.name.replace(path, '').replace(/^\//, ''),
                        size: parseInt(file.metadata.size),
                        modified: new Date(file.metadata.timeCreated),
                        isDirectory: false
                    });
                }
            });

            this._log('info', 'GCP Cloud Storage file listing completed', { path, fileCount: files.length });
            
            return {
                success: true,
                files: files,
                message: `Listed ${files.length} files`,
                details: {
                    path,
                    bucketName: this.settings.bucketName,
                    projectId: this.serviceAccountData.project_id
                }
            };

        } catch (error) {
            this._log('error', 'GCP Cloud Storage file listing failed', { error: error.message, path });
            return {
                success: false,
                files: [],
                message: `Failed to list files: ${error.message}`,
                details: { error: error.message, path }
            };
        }
    }

    /**
     * Download a file from GCP Cloud Storage
     * @param {string} filename - Name of the file to download
     * @param {string} localPath - Local path to save the file
     * @returns {Promise<Object>} Download result
     */
    async downloadFile(filename, localPath) {
        this._log('info', 'Downloading file from GCP Cloud Storage', { filename, localPath });
        
        try {
            // Validate configuration
            if (!this.isServiceConfigured()) {
                throw new Error('Service not properly configured');
            }

            // Ensure service account data is parsed
            if (!this.serviceAccountData) {
                this.serviceAccountData = JSON.parse(this.settings.serviceAccountKey);
            }

            // Import Google Cloud Storage SDK
            const { Storage } = require('@google-cloud/storage');
            const fs = require('fs').promises;
            const path = require('path');

            // Create storage client
            const storage = new Storage({
                credentials: this.serviceAccountData,
                projectId: this.serviceAccountData.project_id
            });

            const bucket = storage.bucket(this.settings.bucketName);
            const file = bucket.file(filename);

            // Download file
            const [fileContent] = await file.download();

            // Ensure directory exists
            const dir = path.dirname(localPath);
            await fs.mkdir(dir, { recursive: true });

            // Write file
            await fs.writeFile(localPath, fileContent);

            this._log('info', 'GCP Cloud Storage file download completed', { filename, localPath, size: fileContent.length });
            
            return {
                success: true,
                localPath: localPath,
                message: 'File downloaded successfully',
                details: {
                    filename,
                    localPath,
                    size: fileContent.length,
                    bucketName: this.settings.bucketName,
                    projectId: this.serviceAccountData.project_id
                }
            };

        } catch (error) {
            this._log('error', 'GCP Cloud Storage file download failed', { error: error.message, filename });
            return {
                success: false,
                message: `Failed to download file: ${error.message}`,
                details: { error: error.message, filename, localPath }
            };
        }
    }

    /**
     * Create a shareable URL with expiration for GCP Cloud Storage
     * @param {string} filename - Name of the file to create URL for
     * @param {Date|number} expiresAt - Expiration date or timestamp
     * @returns {Promise<Object>} URL result
     */
    async createShareableUrl(filename, expiresAt) {
        this._log('info', 'Creating shareable URL for GCP Cloud Storage', { filename, expiresAt });
        
        try {
            // Validate configuration
            if (!this.isServiceConfigured()) {
                throw new Error('Service not properly configured');
            }

            // Ensure service account data is parsed
            if (!this.serviceAccountData) {
                this.serviceAccountData = JSON.parse(this.settings.serviceAccountKey);
            }

            // Import Google Cloud Storage SDK
            const { Storage } = require('@google-cloud/storage');

            // Create storage client
            const storage = new Storage({
                credentials: this.serviceAccountData,
                projectId: this.serviceAccountData.project_id
            });

            const bucket = storage.bucket(this.settings.bucketName);
            const file = bucket.file(filename);

            // Convert expiresAt to Date
            const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

            if (expirationDate.getTime() <= Date.now()) {
                throw new Error('Expiration time must be in the future');
            }

            // Generate signed URL
            const [signedUrl] = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: expirationDate
            });

            this._log('info', 'GCP Cloud Storage shareable URL created', { filename, expiresAt: expirationDate });
            
            return {
                success: true,
                url: signedUrl,
                expiresAt: expirationDate,
                message: 'Shareable URL created successfully',
                details: {
                    filename,
                    expiresAt: expirationDate,
                    bucketName: this.settings.bucketName,
                    projectId: this.serviceAccountData.project_id
                }
            };

        } catch (error) {
            this._log('error', 'GCP Cloud Storage shareable URL creation failed', { error: error.message, filename });
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

module.exports = { GcpStorageService }; 