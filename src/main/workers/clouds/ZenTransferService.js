/**
 * ZenTransfer Upload Service
 * Handles uploads to the ZenTransfer platform
 */

const { UploadServiceBase } = require('./UploadServiceBase.js');

class ZenTransferService extends UploadServiceBase {
    constructor(settings) {
        super(settings);

        console.log("ZenTransferService constructor", JSON.stringify(settings));
    }

    getServiceName() {
        return 'ZenTransfer';
    }

    validateConfiguration() {
        const errors = [];
        
        if (!this.settings.session.token) {
            errors.push('Authentication token is required');
        }
        
        if (!this.settings.globals.serverBaseUrl) {
            errors.push('API base URL is required');
        }

        // ZenTransfer specific required settings
        if (!this.settings.globals.appName) {
            errors.push('App name is required');
        }

        if (!this.settings.globals.appVersion) {
            errors.push('App version is required');
        }

        if (!this.settings.globals.clientId) {
            errors.push('Client ID is required');
        }

        if ( errors.length > 0 ) {
            console.log('!!! ZenTransfer Config Errors:', errors);
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
                this._log('error', 'ZenTransfer connection test failed; invalid configuration', { error: validation.errors.join(', ') });
                return false;
            }

            // Test by creating an upload session
            const result = await this.verifySessionToken(this.settings.session.token);
            if ( result ) {
                this._log('info', 'ZenTransfer connection test successful');
            } else {
                this._log('error', 'ZenTransfer connection test failed');
            }

            return result;

        } catch (error) {
            this._log('error', 'ZenTransfer connection test failed', { error: error.message });
            return false;
        }
    }

    async verifySessionToken(token) {
        try {

            const response = await this._fetch(`${this.settings.serverBaseUrl}/api/upload/verifysession?token=${token}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if ( response.ok ) {
                const data = await response.json();
                if ( data.valid ) {
                    this._log('info', 'Server reports token is valid');
                    return true;
                }
            }

        } catch (error) {}

        this._log('error', 'Unable to communicate with server or token is invalid');
        return false;
    }

    async uploadFile(filePath, remoteName, mimeType, options = {}) {
        this._log('info', `Starting ZenTransfer upload for ${remoteName}/${mimeType}`);
        
        // Generate upload ID early so it's available in error handling
        const uploadId = this._generateUploadId();

        // Copy the last received settings
        this.settings = options;
        
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
            

            // Read file content
            this._emitProgress(0, fileInfo.size); // tell we're reading the file
            const fileContent = await this._readFile(filePath);

            this._emitProgress(1, fileInfo.size); // just to trigger that we're starting


            // Step 1: Initialize file upload
            const initResponse = await this._initializeFileUpload(
                remoteName, 
                fileInfo.size, 
                mimeType, 
                this.settings.session
            );

            this._emitProgress(2, fileInfo.size); // let them know we have a ticket


            // Step 2: Upload to blob storage
            // This is where the real progress updates happen as we transfer bytes
            await this._uploadFileToBlob(
                initResponse.blob_url, 
                fileContent, 
                mimeType,
                (progress) => {
                    const transformedProgress = Math.min(progress, fileInfo.size - 100);
                    this._emitProgress(transformedProgress, fileInfo.size);
                }
            );


            // Step 3: Finalize upload
            const finalResult = await this._finalizeFileUpload(
                initResponse.id, 
                initResponse.finalize_url,
                this.settings.session
            );

            this._emitProgress(fileInfo.size, fileInfo.size); // let them know we're done


            // Return the result

            const uploadResult = {
                success: true,
                url: finalResult.url,
            };

            this._log('info', 'ZenTransfer upload successful');
            return uploadResult;

        } catch (error) {

            const uploadResult = {
                success: false,
                message: `ZenTransfer upload failed: ${error.message}`
            };

            this._log('error', `ZenTransfer upload failed: ${error.message}`);
            return uploadResult;
        }
    }



    /* Internal methods */

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
                'Authorization': `Bearer ${session.token}`,
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

    async _finalizeFileUpload(uploadId, finalizeUrl, session) {
        const postData = JSON.stringify({
            id: uploadId
        });

        const response = await this._fetch(finalizeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/vnd.volt.attachment-finalize-upload-request+json',
                'Authorization': `Bearer ${session.token}`,
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
}

module.exports = { ZenTransferService };