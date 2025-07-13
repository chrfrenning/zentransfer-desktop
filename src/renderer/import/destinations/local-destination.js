/**
 * Local Destination
 * Handles copying files to the local destination directory
 */

import { BaseDestination } from './base-destination.js';

export class LocalDestination extends BaseDestination {
    /**
     * Create a local destination
     * @param {DestinationConfig} config - Destination configuration
     */
    constructor(config) {
        super(config);
        this.destinationPath = config.path;
    }

    /**
     * Initialize the destination
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (!this.destinationPath) {
            console.error('Local destination path not specified');
            return false;
        }

        // Ensure the destination directory exists
        const success = await this.ensureDirectory(this.destinationPath);
        if (!success) {
            console.error('Failed to create destination directory:', this.destinationPath);
            return false;
        }

        return true;
    }

    /**
     * Process a file to this destination
     * @param {FileInfo} fileInfo - Source file information
     * @param {string} sourcePath - Full source file path
     * @param {FolderOrganization} folderOrganization - Folder organization settings
     * @returns {Promise<DestinationResult>} Processing result
     */
    async processFile(fileInfo, sourcePath, folderOrganization) {
        try {
            // Determine destination folder
            const folderPath = this.getDestinationFolder(fileInfo, folderOrganization);
            const finalDestinationDir = folderPath 
                ? this.joinPath(this.destinationPath, folderPath)
                : this.destinationPath;

            // Ensure destination directory exists
            const dirSuccess = await this.ensureDirectory(finalDestinationDir);
            if (!dirSuccess) {
                return {
                    success: false,
                    destinationPath: '',
                    error: `Failed to create destination directory: ${finalDestinationDir}`,
                    metadata: {}
                };
            }

            // Determine final file path
            const destinationFilePath = this.joinPath(finalDestinationDir, fileInfo.name);

            // Copy the file
            await this.copyFile(sourcePath, destinationFilePath);

            return {
                success: true,
                destinationPath: destinationFilePath,
                error: '',
                metadata: {
                    folderPath: folderPath,
                    destinationDir: finalDestinationDir
                }
            };

        } catch (error) {
            console.error('Failed to process file to local destination:', error);
            return {
                success: false,
                destinationPath: '',
                error: error.message,
                metadata: {}
            };
        }
    }

    /**
     * Copy file from source to destination
     * @param {string} sourcePath - Source file path
     * @param {string} destinationPath - Destination file path
     * @returns {Promise<void>}
     */
    async copyFile(sourcePath, destinationPath) {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            
            // Check if destination file already exists
            if (fs.existsSync(destinationPath)) {
                // Generate unique filename
                const uniquePath = this.generateUniqueFilename(destinationPath);
                console.log(`File exists, using unique name: ${uniquePath}`);
                fs.copyFileSync(sourcePath, uniquePath);
                return uniquePath;
            } else {
                fs.copyFileSync(sourcePath, destinationPath);
                return destinationPath;
            }
        } else {
            throw new Error('File operations not supported in browser environment');
        }
    }

    /**
     * Generate unique filename if file already exists
     * @param {string} filePath - Original file path
     * @returns {string} Unique file path
     */
    generateUniqueFilename(filePath) {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const path = require('path');
            
            const dir = path.dirname(filePath);
            const ext = path.extname(filePath);
            const nameWithoutExt = path.basename(filePath, ext);
            
            let counter = 1;
            let uniquePath;
            
            do {
                uniquePath = path.join(dir, `${nameWithoutExt} (${counter})${ext}`);
                counter++;
            } while (fs.existsSync(uniquePath));
            
            return uniquePath;
        }
        
        return filePath;
    }

    /**
     * Get display name for this destination
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'Local Destination';
    }

    /**
     * Get processing priority
     * Local destination has highest priority (should be processed first)
     * @returns {number} Priority value
     */
    getPriority() {
        return 1;
    }

    /**
     * Check if this destination is ready to process files
     * @returns {boolean} Ready status
     */
    isReady() {
        return this.enabled && this.destinationPath && this.destinationPath.trim().length > 0;
    }
} 