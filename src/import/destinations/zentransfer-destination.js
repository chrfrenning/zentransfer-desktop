/**
 * ZenTransfer Destination
 * Handles uploading files to ZenTransfer cloud service
 */

import { BaseDestination } from './base-destination.js';

export class ZenTransferDestination extends BaseDestination {
    /**
     * Create a ZenTransfer destination
     * @param {DestinationConfig} config - Destination configuration
     * @param {Object} uploadManager - Upload manager instance
     */
    constructor(config, uploadManager) {
        super(config);
        this.uploadManager = uploadManager;
        this.filesToUpload = [];
    }

    /**
     * Initialize the destination
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (!this.uploadManager) {
            console.error('Upload manager not provided for ZenTransfer destination');
            return false;
        }

        // Clear any pending uploads from previous sessions
        this.filesToUpload = [];
        return true;
    }

    /**
     * Process a file to this destination
     * Note: This doesn't immediately upload, but queues the file for upload
     * The actual upload happens after the file is copied to the local destination
     * @param {FileInfo} fileInfo - Source file information
     * @param {string} sourcePath - Full source file path (this will be the destination file path)
     * @param {FolderOrganization} folderOrganization - Folder organization settings
     * @returns {Promise<DestinationResult>} Processing result
     */
    async processFile(fileInfo, sourcePath, folderOrganization) {
        try {
            // For ZenTransfer, we expect sourcePath to be the destination file path
            // (from the local destination processing)
            
            // Queue the file for upload
            this.filesToUpload.push({
                filePath: sourcePath,
                fileInfo: fileInfo,
                folderOrganization: folderOrganization
            });

            return {
                success: true,
                destinationPath: sourcePath, // The file path that will be uploaded
                error: '',
                metadata: {
                    queuedForUpload: true,
                    uploadQueueSize: this.filesToUpload.length
                }
            };

        } catch (error) {
            console.error('Failed to queue file for ZenTransfer upload:', error);
            return {
                success: false,
                destinationPath: '',
                error: error.message,
                metadata: {}
            };
        }
    }

    /**
     * Upload all queued files to ZenTransfer
     * This should be called after all files have been processed by other destinations
     * @returns {Promise<Array<DestinationResult>>} Upload results
     */
    async uploadQueuedFiles() {
        if (this.filesToUpload.length === 0) {
            return [];
        }

        const results = [];

        try {
            // Convert file paths to File objects for upload manager
            const fileObjects = await this.createFileObjects(this.filesToUpload.map(item => item.filePath));
            
            if (fileObjects.length > 0) {
                // Add files to upload queue
                await this.uploadManager.addFiles(fileObjects);
                
                // Create success results for all files
                for (let i = 0; i < this.filesToUpload.length; i++) {
                    const item = this.filesToUpload[i];
                    results.push({
                        success: true,
                        destinationPath: item.filePath,
                        error: '',
                        metadata: {
                            addedToUploadQueue: true,
                            fileName: item.fileInfo.name
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Failed to add files to upload queue:', error);
            
            // Create error results for all files
            for (const item of this.filesToUpload) {
                results.push({
                    success: false,
                    destinationPath: item.filePath,
                    error: `Failed to add to upload queue: ${error.message}`,
                    metadata: {
                        fileName: item.fileInfo.name
                    }
                });
            }
        }

        // Clear the queue after processing
        this.filesToUpload = [];
        
        return results;
    }

    /**
     * Create File objects from file paths
     * @param {Array<string>} filePaths - Array of file paths
     * @returns {Promise<Array<File>>} Array of File objects
     */
    async createFileObjects(filePaths) {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const path = require('path');
            
            const fileObjects = [];
            
            for (const filePath of filePaths) {
                try {
                    const buffer = fs.readFileSync(filePath);
                    const fileName = path.basename(filePath);
                    const stats = fs.statSync(filePath);
                    
                    const file = new File([buffer], fileName, {
                        type: this.getMimeType(path.extname(fileName)),
                        lastModified: stats.mtime.getTime()
                    });
                    
                    fileObjects.push(file);
                } catch (error) {
                    console.error('Failed to create file object for:', filePath, error);
                }
            }
            
            return fileObjects;
        } else {
            throw new Error('File operations not supported in browser environment');
        }
    }

    /**
     * Get MIME type from extension
     * @param {string} ext - File extension
     * @returns {string} MIME type
     */
    getMimeType(ext) {
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska',
            '.wmv': 'video/x-ms-wmv',
            '.webm': 'video/webm',
            '.m4v': 'video/mp4'
        };
        
        return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    }

    /**
     * Get display name for this destination
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'ZenTransfer Upload';
    }

    /**
     * Get processing priority
     * ZenTransfer has lowest priority (should be processed last)
     * @returns {number} Priority value
     */
    getPriority() {
        return 200;
    }

    /**
     * Check if this destination is ready to process files
     * @returns {boolean} Ready status
     */
    isReady() {
        return this.enabled && this.uploadManager !== null;
    }

    /**
     * Get the number of files queued for upload
     * @returns {number} Queue size
     */
    getQueueSize() {
        return this.filesToUpload.length;
    }

    /**
     * Clear the upload queue
     */
    clearQueue() {
        this.filesToUpload = [];
    }

    /**
     * Cleanup resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        // Clear any pending uploads
        this.filesToUpload = [];
    }
} 