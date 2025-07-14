/**
 * Enhanced Upload Service Base
 * Extends UploadServiceBase to add thumbnail and preview generation
 * Maintains complete compatibility with existing upload interface
 */

const { UploadServiceBase } = require('./upload-service-base.js');
const { ThumbnailService } = require('../../shared/services/thumbnail-service.js');

class EnhancedUploadServiceBase extends UploadServiceBase {
    constructor(settings = {}) {
        super(settings);
        this.thumbnailService = new ThumbnailService();
    }

    /**
     * Override the main uploadFile method to add thumbnail/preview functionality
     * Maintains exact same interface as original
     * @param {string} filePath - Local file path
     * @param {string} remoteName - Remote file name/path
     * @param {string} mimeType - MIME type of the file
     * @param {Object} options - Additional upload options
     * @returns {Promise<Object>} Upload result with { success: boolean, url?: string, message: string, details?: any }
     */
    async uploadFile(filePath, remoteName, mimeType, options = {}) {
        // Get preferences from options or load defaults
        const preferences = await this.getUploadPreferences(options);
        
        console.log('Enhanced upload preferences:', preferences);
        
        // If no enhancements enabled, use original implementation
        if (!preferences.createPreviews) {
            return await this.uploadOriginalFile(filePath, remoteName, mimeType, options);
        }

        // Enhanced upload flow
        try {
            // 1. Always upload original file first
            const originalResult = await this.uploadOriginalFile(filePath, remoteName, mimeType, options);
            
            if (!originalResult.success) {
                // If original upload fails, return immediately
                return originalResult;
            }

            // 2. Process thumbnails in the background (don't block on failures)
            const backgroundTasks = [];
            
            if (preferences.createPreviews && this.shouldCreateThumbnails(filePath, mimeType)) {
                const thumbnailTask = this.processThumbnailUploads(filePath, remoteName, options, preferences)
                    .catch(error => {
                        console.warn('Thumbnail upload failed:', error);
                        return { success: false, error: error.message };
                    });
                backgroundTasks.push(thumbnailTask);
            }

            // Wait for background tasks but don't fail if they fail
            const backgroundResults = await Promise.allSettled(backgroundTasks);
            
            // Log any background failures but don't affect main result
            backgroundResults.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.warn(`Background thumbnail upload task failed:`, result.reason);
                } else if (result.value && !result.value.success) {
                    console.warn(`Background thumbnail upload task failed:`, result.value.error);
                }
            });

            // Return original upload result (maintaining compatibility)
            // Optionally add metadata about additional uploads in details
            const enhancedResult = {
                ...originalResult,
                details: {
                    ...originalResult.details,
                    enhancedUpload: {
                        thumbnailsGenerated: backgroundResults.length > 0 && backgroundResults[0].status === 'fulfilled',
                        additionalFiles: this.getAdditionalFilesList(remoteName, preferences)
                    }
                }
            };

            return enhancedResult;

        } catch (error) {
            // If enhancement fails, try original upload as fallback
            console.warn('Enhanced upload failed, falling back to original:', error);
            return await this.uploadOriginalFile(filePath, remoteName, mimeType, options);
        }
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

    /**
     * Get upload preferences from options or defaults
     * @param {Object} options - Upload options
     * @returns {Promise<Object>} Preferences object
     */
    async getUploadPreferences(options) {
        // Check if preferences are passed in options first
        if (options.metadataOptions) {
            return options.metadataOptions;
        }

        // Otherwise use defaults
        return {
            createPreviews: false,
            extractMetadata: false,
            thumbnailSize: 400,
            thumbnailQuality: 90,
            previewSize: 1920,
            previewQuality: 90
        };
    }

    /**
     * Check if thumbnails should be created for this file
     * @param {string} filePath - File path
     * @param {string} mimeType - MIME type
     * @returns {boolean} True if thumbnails should be created
     */
    shouldCreateThumbnails(filePath, mimeType) {
        return this.thumbnailService.isSupported(filePath, mimeType);
    }

    /**
     * Process and upload thumbnails/previews
     * @param {string} filePath - Original file path
     * @param {string} remoteName - Remote name of original file
     * @param {Object} options - Upload options
     * @param {Object} preferences - Upload preferences
     * @returns {Promise<Object>} Upload results
     */
    async processThumbnailUploads(filePath, remoteName, options, preferences) {
        try {
            console.log(`Generating thumbnails for ${filePath}`);
            
            // Generate both thumbnail and preview
            const results = await this.thumbnailService.generateBoth(filePath, {
                thumbnailSize: preferences.thumbnailSize,
                thumbnailQuality: preferences.thumbnailQuality,
                previewSize: preferences.previewSize,
                previewQuality: preferences.previewQuality,
                originalFilename: remoteName
            });

            const uploadResults = [];

            // Upload thumbnail if generated successfully
            if (results.thumbnail.success) {
                try {
                    const thumbnailResult = await this.uploadThumbnailBuffer(
                        results.thumbnail.buffer,
                        results.thumbnail.filename,
                        results.thumbnail.mimeType,
                        options
                    );
                    uploadResults.push({
                        type: 'thumbnail',
                        filename: results.thumbnail.filename,
                        ...thumbnailResult
                    });
                    console.log(`Thumbnail uploaded successfully: ${results.thumbnail.filename}`);
                } catch (error) {
                    console.error('Failed to upload thumbnail:', error);
                    uploadResults.push({
                        type: 'thumbnail',
                        filename: results.thumbnail.filename,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Upload preview if generated successfully
            if (results.preview.success) {
                try {
                    const previewResult = await this.uploadThumbnailBuffer(
                        results.preview.buffer,
                        results.preview.filename,
                        results.preview.mimeType,
                        options
                    );
                    uploadResults.push({
                        type: 'preview',
                        filename: results.preview.filename,
                        ...previewResult
                    });
                    console.log(`Preview uploaded successfully: ${results.preview.filename}`);
                } catch (error) {
                    console.error('Failed to upload preview:', error);
                    uploadResults.push({
                        type: 'preview',
                        filename: results.preview.filename,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                uploads: uploadResults,
                thumbnailGenerated: results.thumbnail.success,
                previewGenerated: results.preview.success
            };

        } catch (error) {
            console.error('Failed to process thumbnails:', error);
            return {
                success: false,
                error: error.message,
                uploads: []
            };
        }
    }

    /**
     * Upload a thumbnail/preview buffer
     * Uses a temporary file approach to work with existing upload infrastructure
     * @param {Buffer} buffer - Image buffer
     * @param {string} filename - Target filename
     * @param {string} mimeType - MIME type
     * @param {Object} options - Upload options
     * @returns {Promise<Object>} Upload result
     */
    async uploadThumbnailBuffer(buffer, filename, mimeType, options) {
        const fs = require('fs').promises;
        const path = require('path');
        const os = require('os');
        
        // Create temporary file
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `thumb_${Date.now()}_${filename}`);
        
        try {
            // Write buffer to temporary file
            await fs.writeFile(tempFile, buffer);
            
            // Upload using the original upload method
            const result = await this.uploadOriginalFile(tempFile, filename, mimeType, {
                ...options,
                skipDuplicates: false // Don't skip duplicates for thumbnails
            });
            
            return result;
            
        } finally {
            // Clean up temporary file
            try {
                await fs.unlink(tempFile);
            } catch (cleanupError) {
                console.warn('Failed to cleanup temporary file:', cleanupError);
            }
        }
    }

    /**
     * Get list of additional files that will be uploaded
     * @param {string} remoteName - Original remote name
     * @param {Object} preferences - Upload preferences
     * @returns {Array<string>} List of additional filenames
     */
    getAdditionalFilesList(remoteName, preferences) {
        const additionalFiles = [];
        
        if (preferences.createPreviews) {
            additionalFiles.push(
                this.thumbnailService.generateThumbnailFilename(remoteName),
                this.thumbnailService.generatePreviewFilename(remoteName)
            );
        }
        
        return additionalFiles;
    }
}

module.exports = { EnhancedUploadServiceBase }; 