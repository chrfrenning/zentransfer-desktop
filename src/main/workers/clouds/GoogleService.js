/**
 * GCP Cloud Storage Upload Service
 * Handles uploads to Google Cloud Storage
 */

const { StorageServiceBase } = require('./StorageServiceBase.js');
const { Storage } = require('@google-cloud/storage');

class GoogleService extends StorageServiceBase {
    constructor(settings = {}) {
        super(settings);
    }

    getServiceName() {
        return 'GCP Cloud Bucket';
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
                this._log('error', 'Connection test failed, invalid configuration');
                return false;
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

            // Create storage client with service account credentials
            const storage = new Storage({
                credentials: this.serviceAccountData,
                projectId: this.serviceAccountData.project_id
            });

            // Get bucket reference
            this._log('info', 'Getting bucket reference', { bucketName: this.settings.bucketName });
            const bucket = storage.bucket(this.settings.bucketName);

            // Test bucket access by listing objects (this verifies both connectivity and permissions)
            let objectCount = 0;
            
            try {
                const [files] = await bucket.getFiles({ maxResults: 10 }); // Limit to 10 files for testing
                objectCount = files.length;

                this._log('info', 'Successfully listed bucket objects', { 
                    objectCount,
                    sampleFiles: files.slice(0, 3).map(f => f.name)
                });

            } catch (listError) {
                // If we can't list objects, the bucket might not exist or we don't have permission
                this._log('warn', 'Could not list bucket objects', { error: listError.message });
                return false;
            }

            // Try to get bucket metadata for additional info (optional)
            let metadata = null;
            try {

                [metadata] = await bucket.getMetadata();

            } catch (metadataError) {
                this._log('warn', 'Could not get bucket metadata, but can list objects', { error: metadataError.message });
            }

            this._log('info', 'GCP Cloud Storage connection test completed');
            return true;

        } catch (error) {

            this._log('error', 'GCP Cloud Storage connection test failed', { error: error.message });
            return false;

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

    async uploadOriginalFile(filePath, remoteName, mimeType, options = {}) {
        this._log('info', 'Starting GCP Cloud Storage upload', { remoteName, mimeType });
        
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
            
            // Check for duplicates and possibly change filename
            this._emitProgress(1, fileInfo.size);
            let finalRemoteName = remoteName;
            if (options.skipDuplicates) {
                // Original behavior: check for duplicates and skip if found
                const dupeCheck = await this.checkIfDuplicate(remoteName, fileInfo.size);
                if ( dupeCheck.isDuplicate ) {
                    this._log('info', 'Skipping duplicate file upload to GCP', { remoteName, size: fileInfo.size });
                    
                    return {
                        success: true,
                        url: `${this.getEndpointUrl()}/${remoteName}`,
                        skipped: true
                    };
                }
            } else {
                
                finalRemoteName = await this.generateUniqueRemoteName(remoteName);

            }

            // Create storage client with service account credentials
            const storage = new Storage({
                credentials: this.serviceAccountData,
                projectId: this.serviceAccountData.project_id
            });

            // Get bucket and file references with final remote name
            const bucket = storage.bucket(this.settings.bucketName);
            const file = bucket.file(finalRemoteName);


            // Read file content
            this._emitProgress(2, fileInfo.size);
            const fileContent = await this._readFile(filePath);

            // Set upload options
            this._emitProgress(3, fileInfo.size);
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
            this._emitProgress(fileInfo.size, fileInfo.size);

            // Construct the GCS URL with final remote name
            const gcsUrl = `https://storage.googleapis.com/${this.settings.bucketName}/${finalRemoteName}`;

            return {
                success: true,
                url: gcsUrl
            };

        } catch (error) {

            this._log('error', 'GCP Cloud Storage upload failed', error);

            return {
                success: false,
                message: `GCP Cloud Storage upload failed: ${error.message}`
            };
        }
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
            if (!this.validateConfiguration()) {
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
            if (!this.validateConfiguration()) {
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
            if (!this.validateConfiguration()) {
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

module.exports = { GoogleService }; 