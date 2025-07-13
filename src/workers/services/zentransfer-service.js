/**
 * ZenTransfer Upload Service
 * Handles uploads to the ZenTransfer platform
 */

const { UploadServiceBase } = require('./upload-service-base.js');

class ZenTransferService extends UploadServiceBase {
    constructor(settings = {}) {
        super(settings);
        this.apiBaseUrl = settings.apiBaseUrl || 'https://api.zentransfer.io';
        this.activeUploads = new Map();
        this.currentSession = null;
    }

    getServiceName() {
        return 'ZenTransfer';
    }

    validateConfiguration() {
        const errors = [];
        
        if (!this.settings.token) {
            errors.push('Authentication token is required');
        }
        
        if (!this.settings.apiBaseUrl && !this.apiBaseUrl) {
            errors.push('API base URL is required');
        }

        // ZenTransfer specific required settings
        if (!this.settings.appName) {
            errors.push('App name is required');
        }

        if (!this.settings.appVersion) {
            errors.push('App version is required');
        }

        if (!this.settings.clientId) {
            errors.push('Client ID is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async testConnection() {
        this._log('info', 'Testing ZenTransfer connection');
        
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

            // Test by creating an upload session
            const session = await this._createUploadSession();
            
            const result = {
                success: true,
                message: 'ZenTransfer connection successful',
                details: {
                    parentId: session.parentId,
                    expiresAt: new Date(session.expiresAt).toISOString()
                }
            };
            
            // Store the session for future uploads
            this.currentSession = session;
            
            this._storeTestResult(result);
            this._log('info', 'ZenTransfer connection test successful');
            return result;

        } catch (error) {
            const result = {
                success: false,
                message: `ZenTransfer connection failed: ${error.message}`,
                details: { error: error.message }
            };
            
            this._storeTestResult(result);
            this._log('error', 'ZenTransfer connection test failed', { error: error.message });
            return result;
        }
    }

    async uploadFile(filePath, remoteName, mimeType, options = {}) {
        this._log('info', 'Starting ZenTransfer upload', { remoteName, mimeType });
        
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
            
            // Read file content
            const fileContent = await this._readFile(filePath);
            
            // Track upload
            this.activeUploads.set(uploadId, {
                status: 'uploading',
                progress: 0,
                startTime: Date.now()
            });

            // Create upload session if needed
            let session = this.currentSession;
            if (!session || this._isSessionExpired(session)) {
                this._updateProgress(uploadId, 5, 'Creating upload session...');
                session = await this._createUploadSession();
                this.currentSession = session;
            }

            this._updateProgress(uploadId, 10, 'Initializing upload...');

            // Step 1: Initialize file upload
            const initResponse = await this._initializeFileUpload(
                remoteName, 
                fileInfo.size, 
                mimeType, 
                session
            );

            this._updateProgress(uploadId, 20, 'Upload initialized');

            // Step 2: Upload to blob storage
            await this._uploadFileToBlob(
                initResponse.blob_url, 
                fileContent, 
                mimeType,
                (progress) => {
                    // Map blob upload progress to 20-90% of total progress
                    const totalProgress = 20 + Math.round(progress * 0.7);
                    this._updateProgress(uploadId, totalProgress, 'Uploading...');
                }
            );

            this._updateProgress(uploadId, 90, 'Finalizing upload...');

            // Step 3: Finalize upload
            const finalResult = await this._finalizeFileUpload(
                initResponse.id, 
                initResponse.finalize_url
            );

            // Update upload status
            this.activeUploads.set(uploadId, {
                status: 'completed',
                progress: 100,
                startTime: this.activeUploads.get(uploadId).startTime,
                endTime: Date.now()
            });

            const uploadResult = {
                success: true,
                url: finalResult.url,
                message: 'File uploaded successfully to ZenTransfer',
                details: {
                    uploadId,
                    fileId: finalResult.id,
                    size: fileInfo.size,
                    remoteName,
                    mimeType,
                    zentransferUploadId: initResponse.id
                }
            };

            this._log('info', 'ZenTransfer upload successful', uploadResult.details);
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
                message: `ZenTransfer upload failed: ${error.message}`,
                details: { error: error.message, filePath, remoteName }
            };

            this._log('error', 'ZenTransfer upload failed', uploadResult.details);
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

        // In a real implementation, you would cancel the actual HTTP request
        this.activeUploads.set(uploadId, {
            ...upload,
            status: 'cancelled',
            endTime: Date.now()
        });

        this._log('info', 'ZenTransfer upload cancelled', { uploadId });
        return true;
    }

    sanitizeSettings(settings) {
        const sanitized = super.sanitizeSettings(settings);
        
        // ZenTransfer-specific sensitive fields
        if (sanitized.token) {
            sanitized.token = '[REDACTED]';
        }
        
        return sanitized;
    }

    /**
     * Create upload session - Step 0
     * @returns {Promise<Object>} Session data
     * @private
     */
    async _createUploadSession() {
        this._log('info', 'Creating ZenTransfer upload session');

        const postData = JSON.stringify({
            app_name: this.settings.appName,
            app_version: this.settings.appVersion,
            client_id: this.settings.clientId
        });

        const response = await this._fetch(`${this.apiBaseUrl}/api/upload/startsession`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.token}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            body: postData
        });

        if (!response.ok) {
            throw new Error(`Failed to create upload session: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        const session = {
            parentId: data.parent_id,
            uploadUrl: data.upload_url,
            expiresAt: new Date(data.expires_at).getTime()
        };

        this._log('info', 'ZenTransfer upload session created', { parentId: session.parentId });
        return session;
    }

    /**
     * Initialize file upload - Step 1
     * @param {string} fileName - File name
     * @param {number} fileSize - File size in bytes
     * @param {string} mimeType - MIME type
     * @param {Object} session - Upload session
     * @returns {Promise<Object>} Initialize response
     * @private
     */
    async _initializeFileUpload(fileName, fileSize, mimeType, session) {
        const postData = JSON.stringify({
            parent_id: session.parentId,
            parent_type: 'CONTAINER',
            name: fileName,
            mime_type: mimeType,
            size: fileSize
        });

        const response = await this._fetch(session.uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/vnd.volt.attachment-upload-request+json',
                'Authorization': `Bearer ${this.settings.token}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            body: postData
        });

        if (!response.ok) {
            throw new Error(`Failed to initialize file upload: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.id || !data.blob_url || !data.finalize_url) {
            throw new Error('Invalid response from initialize upload');
        }

        return data;
    }

    /**
     * Upload file to blob storage - Step 2
     * @param {string} blobUrl - Blob storage URL
     * @param {Buffer} fileContent - File content
     * @param {string} mimeType - MIME type
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<void>}
     * @private
     */
    async _uploadFileToBlob(blobUrl, fileContent, mimeType, onProgress) {
        const response = await this._fetch(blobUrl, {
            method: 'PUT',
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': mimeType || 'application/octet-stream',
                'Content-Length': fileContent.length
            },
            body: fileContent
        });

        if (!response.ok) {
            throw new Error(`Blob upload failed: ${response.status} ${response.statusText}`);
        }

        // Report 100% progress for blob upload
        if (onProgress) {
            onProgress(100);
        }
    }

    /**
     * Finalize file upload - Step 3
     * @param {string} uploadId - Upload ID from step 1
     * @param {string} finalizeUrl - Finalize URL from step 1
     * @returns {Promise<Object>} Final result
     * @private
     */
    async _finalizeFileUpload(uploadId, finalizeUrl) {
        const postData = JSON.stringify({
            id: uploadId
        });

        const response = await this._fetch(finalizeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/vnd.volt.attachment-finalize-upload-request+json',
                'Authorization': `Bearer ${this.settings.token}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            body: postData
        });

        if (!response.ok) {
            throw new Error(`Failed to finalize upload: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.id || !data.url) {
            throw new Error('Invalid response from finalize upload');
        }

        return data;
    }

    /**
     * Check if session is expired
     * @param {Object} session - Session to check
     * @returns {boolean} True if expired
     * @private
     */
    _isSessionExpired(session) {
        if (!session || !session.expiresAt) {
            return true;
        }
        
        // Add 5 minute buffer before expiration
        const bufferMs = 5 * 60 * 1000;
        return Date.now() >= (session.expiresAt - bufferMs);
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

module.exports = { ZenTransferService };