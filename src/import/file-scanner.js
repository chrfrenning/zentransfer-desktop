/**
 * File Scanner
 * Handles scanning directories for supported files
 */

import { getAllSupportedExtensions, getFileType } from './import-types.js';

export class FileScanner {
    /**
     * Scan directory for supported files
     * @param {string} sourcePath - Source directory path
     * @param {ImportOptions} options - Scan options
     * @returns {Promise<Array<FileInfo>>} Array of file information objects
     */
    static async scanDirectory(sourcePath, options) {
        const files = [];
        const supportedExtensions = options.fileExtensions || getAllSupportedExtensions();

        try {
            if (typeof require !== 'undefined') {
                const fs = require('fs');
                const path = require('path');

                const scanDir = (dirPath, relativePath = '') => {
                    const items = fs.readdirSync(dirPath);

                    for (const item of items) {
                        const fullPath = path.join(dirPath, item);
                        const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
                        
                        try {
                            const stats = fs.statSync(fullPath);

                            if (stats.isFile()) {
                                const ext = path.extname(item).toLowerCase();
                                
                                const fileInfo = {
                                    name: item,
                                    path: fullPath,
                                    relativePath: itemRelativePath,
                                    size: stats.size,
                                    type: getFileType(ext),
                                    extension: ext,
                                    created: stats.birthtime,
                                    modified: stats.mtime
                                };
                                
                                files.push(fileInfo);
                                
                            } else if (stats.isDirectory() && options.includeSubdirectories) {
                                // Recursively scan subdirectories if enabled
                                scanDir(fullPath, itemRelativePath);
                            }
                        } catch (itemError) {
                            console.warn(`Failed to process item: ${fullPath}`, itemError);
                            // Continue with other files
                        }
                    }
                };

                scanDir(sourcePath);
            } else {
                throw new Error('File system access not available in browser environment');
            }
        } catch (error) {
            console.error('Failed to scan directory:', error);
            throw new Error(`Failed to scan source directory: ${error.message}`);
        }

        return files;
    }

    /**
     * Get directory statistics
     * @param {string} sourcePath - Source directory path
     * @param {ImportOptions} options - Scan options
     * @returns {Promise<Object>} Directory statistics
     */
    static async getDirectoryStats(sourcePath, options) {
        try {
            const files = await this.scanDirectory(sourcePath, options);
            
            const stats = {
                totalFiles: files.length,
                totalSize: files.reduce((sum, file) => sum + file.size, 0),
                fileTypes: {},
                largestFile: null,
                oldestFile: null,
                newestFile: null
            };

            // Calculate file type distribution
            files.forEach(file => {
                if (!stats.fileTypes[file.type]) {
                    stats.fileTypes[file.type] = { count: 0, size: 0 };
                }
                stats.fileTypes[file.type].count++;
                stats.fileTypes[file.type].size += file.size;

                // Track largest file
                if (!stats.largestFile || file.size > stats.largestFile.size) {
                    stats.largestFile = file;
                }

                // Track oldest file
                if (!stats.oldestFile || file.created < stats.oldestFile.created) {
                    stats.oldestFile = file;
                }

                // Track newest file
                if (!stats.newestFile || file.created > stats.newestFile.created) {
                    stats.newestFile = file;
                }
            });

            return stats;
        } catch (error) {
            console.error('Failed to get directory stats:', error);
            throw error;
        }
    }

    /**
     * Validate source directory
     * @param {string} sourcePath - Source directory path
     * @returns {Promise<Object>} Validation result
     */
    static async validateSourceDirectory(sourcePath) {
        const result = {
            valid: false,
            exists: false,
            readable: false,
            isEmpty: false,
            error: null
        };

        try {
            if (typeof require !== 'undefined') {
                const fs = require('fs');

                // Check if path exists
                if (!fs.existsSync(sourcePath)) {
                    result.error = 'Source directory does not exist';
                    return result;
                }
                result.exists = true;

                // Check if it's a directory
                const stats = fs.statSync(sourcePath);
                if (!stats.isDirectory()) {
                    result.error = 'Source path is not a directory';
                    return result;
                }

                // Check if readable
                try {
                    fs.accessSync(sourcePath, fs.constants.R_OK);
                    result.readable = true;
                } catch (accessError) {
                    result.error = 'Source directory is not readable';
                    return result;
                }

                // Check if directory is empty
                const items = fs.readdirSync(sourcePath);
                result.isEmpty = items.length === 0;

                result.valid = true;
            } else {
                result.error = 'File system access not available in browser environment';
            }
        } catch (error) {
            result.error = error.message;
        }

        return result;
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Estimate processing time
     * @param {Array<FileInfo>} files - Array of files to process
     * @param {number} avgSpeedMBps - Average processing speed in MB/s
     * @returns {Object} Time estimates
     */
    static estimateProcessingTime(files, avgSpeedMBps = 50) {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const totalSizeMB = totalSize / (1024 * 1024);
        const estimatedSeconds = totalSizeMB / avgSpeedMBps;

        return {
            totalFiles: files.length,
            totalSize: totalSize,
            totalSizeMB: totalSizeMB,
            estimatedSeconds: estimatedSeconds,
            estimatedMinutes: estimatedSeconds / 60,
            formattedTime: this.formatDuration(estimatedSeconds)
        };
    }

    /**
     * Format duration in seconds to human readable format
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration
     */
    static formatDuration(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)} seconds`;
        } else if (seconds < 3600) {
            const minutes = Math.round(seconds / 60);
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.round((seconds % 3600) / 60);
            return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
    }
} 