/**
 * Backup Destination
 * Handles copying files to the backup directory
 */

import { BaseDestination } from './base-destination.js';

export class BackupDestination extends BaseDestination {
    /**
     * Create a backup destination
     * @param {DestinationConfig} config - Destination configuration
     */
    constructor(config) {
        super(config);
        this.backupPath = config.path;
    }

    /**
     * Initialize the destination
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (!this.backupPath) {
            console.error('Backup destination path not specified');
            return false;
        }

        // Ensure the backup directory exists
        const success = await this.ensureDirectory(this.backupPath);
        if (!success) {
            console.error('Failed to create backup directory:', this.backupPath);
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
            // Determine backup folder (same structure as main destination)
            const folderPath = this.getDestinationFolder(fileInfo, folderOrganization);
            const finalBackupDir = folderPath 
                ? this.joinPath(this.backupPath, folderPath)
                : this.backupPath;

            // Ensure backup directory exists
            const dirSuccess = await this.ensureDirectory(finalBackupDir);
            if (!dirSuccess) {
                return {
                    success: false,
                    destinationPath: '',
                    error: `Failed to create backup directory: ${finalBackupDir}`,
                    metadata: {}
                };
            }

            // Determine final file path
            const backupFilePath = this.joinPath(finalBackupDir, fileInfo.name);

            // Copy the file
            const finalPath = await this.copyFile(sourcePath, backupFilePath);

            return {
                success: true,
                destinationPath: finalPath,
                error: '',
                metadata: {
                    folderPath: folderPath,
                    backupDir: finalBackupDir
                }
            };

        } catch (error) {
            console.error('Failed to process file to backup destination:', error);
            return {
                success: false,
                destinationPath: '',
                error: error.message,
                metadata: {}
            };
        }
    }

    /**
     * Copy file from source to backup
     * @param {string} sourcePath - Source file path
     * @param {string} backupPath - Backup file path
     * @returns {Promise<string>} Final backup file path
     */
    async copyFile(sourcePath, backupPath) {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            
            // Check if backup file already exists
            if (fs.existsSync(backupPath)) {
                // Generate unique filename
                const uniquePath = this.generateUniqueFilename(backupPath);
                console.log(`Backup file exists, using unique name: ${uniquePath}`);
                fs.copyFileSync(sourcePath, uniquePath);
                return uniquePath;
            } else {
                fs.copyFileSync(sourcePath, backupPath);
                return backupPath;
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
        return 'Backup';
    }

    /**
     * Get processing priority
     * Backup has medium priority (after local destination)
     * @returns {number} Priority value
     */
    getPriority() {
        return 50;
    }

    /**
     * Check if this destination is ready to process files
     * @returns {boolean} Ready status
     */
    isReady() {
        return this.enabled && this.backupPath && this.backupPath.trim().length > 0;
    }
} 