/**
 * Enhanced Upload Service Base
 * Extends UploadServiceBase to add thumbnail and preview generation
 * Maintains complete compatibility with existing upload interface
 */

const { UploadServiceBase } = require('./UploadServiceBase.js');
const { ThumbnailService } = require('../../services/ThumbnailService.js');
const { MetadataService } = require('../../services/MetadataService.js');

const tmp = require('tmp');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_UNIQUE_FILENAME_GENERATIONS = 100;



class StorageServiceBase extends UploadServiceBase {
    constructor(settings = {}) {
        super(settings);
    }

    async initialize(options) {
        if ( options.createPreviews ) {
            this.thumbnailService = new ThumbnailService();
        }

        this.metadataService = new MetadataService();
    }
    
    async getUploadPreferences(options) {
        // Check if preferences are passed in options first
        if (options.processingOptions) {
            return options.processingOptions;
        }

        // Otherwise use defaults
        return {
            createPreviews: false,
            extractMetadata: false
        };
    }
    
    async uploadFile(filePath, remoteName, mimeType, options = {}) {

        // Get preferences from options or load defaults
        const preferences = await this.getUploadPreferences(options);
        console.log('Processing preferences:', preferences);

        if (!preferences.createPreviews && !preferences.extractMetadata) {
            return await this.uploadOriginalFile(filePath, remoteName, mimeType, options);
        }

        console.log('Going into file processing for metadata and previews');
        this.initialize(preferences);

        // Enhanced upload flow
        try {
            const additionalFiles = {};


            /*
             *  0. Check if the file is a duplicate
             *
             *  We must know the remote name to coordinate across upload of md, th, pv
             *
            */

            remoteName = await this.generateUniqueRemoteName(remoteName);


            /* 
             * 1. Always upload original file first async (at least start it)
             *
            */

            console.log('Starting upload of original file...');
            const originalResultPromise = this.uploadOriginalFile(filePath, remoteName, mimeType, options);



            /* 
             * 2. Extract and upload metadata if enabled
             *
            */

            let metadataResult = null;
            if ( preferences.extractMetadata || preferences.createPreviews ) {
                metadataResult = await this.metadataService.extractMetadata(filePath);
            }

            if ( metadataResult && metadataResult.success  ) {
                const metadataUpload = await this.processMetadataUpload(remoteName, metadataResult.metadata);
                if ( metadataUpload.success ) {
                    additionalFiles.metadata = metadataUpload.url;
                }
            }
            
            let extractedPreviews = null;
            if ( metadataResult && metadataResult.success ) {
                extractedPreviews = await this.metadataService.extractThumbnailAndPreview(filePath);
            }



            /* 
             * 3. Create thumbnail and preview from the original file
             *
            */
            
            if ( preferences.createPreviews ) {


                // Preview

                const previewRemoteName = this.thumbnailService.generatePreviewFilename(remoteName);
                
                const previewResult = await this.thumbnailService.generatePreview(filePath, {
                    size: preferences.previewSize,
                    quality: preferences.previewQuality
                });
                
                
                if ( previewResult.success ) { 
                    const previewUpload = await this.uploadFromBuffer(previewResult.buffer, previewRemoteName, 'image/webp', {
                        skipDuplicates: false
                    });

                    if ( previewUpload.success ) {
                        additionalFiles.preview = previewUpload.url;
                    }
                } else if ( extractedPreviews && extractedPreviews.preview ) {

                    const previewUpload = await this.uploadOriginalFile(extractedPreviews.preview, previewRemoteName, 'image/webp', {
                        skipDuplicates: false
                    });

                    if ( previewUpload.success ) {
                        additionalFiles.preview = previewUpload.url;
                    }
                }


                // Thumbnail

                const thumbnailRemoteName = this.thumbnailService.generateThumbnailFilename(remoteName);

                const thumbnailResult = await this.thumbnailService.generatePreview(filePath, {
                    size: preferences.thumbnailSize,
                    quality: preferences.thumbnailQuality
                });

                if ( thumbnailResult.success ) {

                    const thumbnailUpload = await this.uploadFromBuffer(thumbnailResult.buffer, thumbnailRemoteName, 'image/webp', {
                        skipDuplicates: false
                    });

                    if ( thumbnailUpload.success ) {
                        additionalFiles.thumbnail = thumbnailUpload.url;
                    }
                } else if ( extractedPreviews && extractedPreviews.thumbnail ) {

                    const thumbnailUpload = await this.uploadOriginalFile(extractedPreviews.thumbnail, thumbnailRemoteName, 'image/webp', {
                        skipDuplicates: false
                    });

                    if ( thumbnailUpload.success ) {
                        additionalFiles.thumbnail = thumbnailUpload.url;
                    }
                } else if ( extractedPreviews && extractedPreviews.preview ) {

                    const thumbnailResult = await this.thumbnailService.generatePreview(extractedPreviews.preview, {
                        size: preferences.thumbnailSize,
                        quality: preferences.thumbnailQuality
                    });

                    const thumbnailUpload = await this.uploadFromBuffer(thumbnailResult.buffer, thumbnailRemoteName, 'image/webp', {
                        skipDuplicates: false
                    });

                    if ( thumbnailUpload.success ) {
                        additionalFiles.thumbnail = thumbnailUpload.url;
                    }
                }
            }


            /* 
             * 4. Wait for the upload to complete, and mesh everything together
             *
            */

            // Wait for the original upload to complete
            const originalResult = await originalResultPromise;
            if ( !originalResult.success ) {
                return originalResult;
            }

            // Return original upload result (maintaining compatibility)
            // Optionally add metadata about additional uploads in details
            const result = {
                success: true,
                url: originalResult.url
            };

            if ( additionalFiles.metadata ) result.metadataUrl = additionalFiles.metadata;
            if ( additionalFiles.thumbnail ) result.thumbnailUrl = additionalFiles.thumbnail;
            if ( additionalFiles.preview ) result.previewUrl = additionalFiles.preview;

            return result;

        } catch (error) {

            // If enhancement fails, try original upload as fallback
            console.warn('Enhanced upload failed, falling back to original:', error);
            return await this.uploadOriginalFile(filePath, remoteName, mimeType, options);

        }
    }
    
    async processMetadataUpload(remoteFilePath, metadata) {
        try {

            const remoteMetaDataPath = this.metadataService.generateMetadataFilename(remoteFilePath);
            
            // Upload metadata JSON
            const uploadResult = await this.uploadFromBuffer(
                Buffer.from(JSON.stringify(metadata), 'utf8'),
                remoteMetaDataPath,
                'application/json',
                {
                    skipDuplicates: false
                }
            );
            
            if (uploadResult.success) {
                console.log(`Metadata uploaded successfully for: ${remoteFilePath}`);
            } else {
                console.error('Failed to upload metadata for', remoteFilePath, uploadResult.message);
            }
            
            return {
                success: uploadResult.success,
                url: uploadResult.url
            };
            
        } catch (error) {
            console.error('Metadata processing failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async uploadFromBuffer(buffer, remoteFilePath, mimeType, options) {
        const tempFile = tmp.fileSync({ prefix: 'ztmp-' });

        try {

            // Write buffer to temporary file
            fs.writeFileSync(tempFile.name, buffer);
            
            // Upload using the original upload method
            const result = await this.uploadOriginalFile(tempFile.name, remoteFilePath, mimeType, {
                ...options,
                skipDuplicates: false // Don't skip duplicates for metadata
            });
            
            return result;
            
        } finally {

            // Clean up temporary file
            try {

                fs.unlinkSync(tempFile.name);

            } catch (cleanupError) {
                console.warn('Failed to cleanup temporary metadata file:', cleanupError);
            }

        }
    }

    async checkIfDuplicate(remoteName, expectedSize) {
        throw new Error('checkIfDuplicate() must be implemented by subclass');

        return {
            exists: false,
            isDuplicate: false
        }
    }
    
    async generateUniqueRemoteName(originalRemoteName) {
        let counter = 1;
        let uniqueName = originalRemoteName;
        
        while (true) {
            const duplicateCheck = await this.checkIfDuplicate(uniqueName, 0);
            if (!duplicateCheck.exists) {
                break;
            }

            const lastDotIndex = originalRemoteName.lastIndexOf('.');
            if (lastDotIndex === -1) {
                uniqueName = `${originalRemoteName} [${counter}]`;
            } else {
                const baseName = originalRemoteName.substring(0, lastDotIndex);
                const extension = originalRemoteName.substring(lastDotIndex);
                uniqueName = `${baseName} [${counter}]${extension}`;
            }
            counter++;
            
            // Safety check to prevent infinite loops
            if (counter > MAX_UNIQUE_FILENAME_GENERATIONS) {
                this._log('warn', 'Unique name generation exceeded limit', { originalRemoteName });
                throw new Error('Unique name generation exceeded limit');
            }

        }
        
        return uniqueName;
    }

    /**
     * Abstract method that child classes must implement
     * This is the original uploadFile logic
     * @param {string} filePath - Local file path
     * @param {string} remoteName - Remote file name/path
     * @param {string} mimeType - MIME type of the file
     * @param {Object} options - Additional upload options
     * @returns {Promise<Object>} Upload result
     */
    async uploadOriginalFile(filePath, remoteName, mimeType, options = {}) {
        throw new Error('uploadOriginalFile() must be implemented by subclass');
    }
}

module.exports = { StorageServiceBase }; 