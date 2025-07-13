/**
 * Base Destination Class
 * Abstract base class for all import destinations
 */

export class BaseDestination {
    /**
     * Create a destination
     * @param {DestinationConfig} config - Destination configuration
     */
    constructor(config) {
        if (this.constructor === BaseDestination) {
            throw new Error('BaseDestination is an abstract class and cannot be instantiated directly');
        }
        
        this.config = config;
        this.type = config.type;
        this.enabled = config.enabled !== false; // Default to true
    }

    /**
     * Initialize the destination
     * Called before processing begins
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * Process a file to this destination
     * @param {FileInfo} fileInfo - Source file information
     * @param {string} sourcePath - Full source file path
     * @param {FolderOrganization} folderOrganization - Folder organization settings
     * @returns {Promise<DestinationResult>} Processing result
     */
    async processFile(fileInfo, sourcePath, folderOrganization) {
        throw new Error('processFile() must be implemented by subclass');
    }

    /**
     * Get the destination folder path for a file
     * @param {FileInfo} fileInfo - File information
     * @param {FolderOrganization} folderOrganization - Folder organization settings
     * @returns {string} Destination folder path
     */
    getDestinationFolder(fileInfo, folderOrganization) {
        if (!folderOrganization.enabled) {
            return '';
        }

        if (folderOrganization.type === 'custom') {
            return folderOrganization.customName || 'Imported Files';
        } else if (folderOrganization.type === 'date') {
            const date = fileInfo.created || new Date();
            return this.formatDateForFolder(date, folderOrganization.dateFormat);
        }

        return '';
    }

    /**
     * Format date according to the selected format
     * @param {Date} date - Date to format
     * @param {string} format - Date format
     * @returns {string} Formatted date string
     */
    formatDateForFolder(date, format) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 
                           'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthName = monthNames[date.getMonth()];

        switch (format) {
            case '2025/05/26': return `${year}/${month}/${day}`;
            case '2025-05-26': return `${year}-${month}-${day}`;
            case '2025/2025-05-26': return `${year}/${year}-${month}-${day}`;
            case '2025/mai 26': return `${year}/${monthName} ${day}`;
            case '2025/05': return `${year}/${month}`;
            case '2025/mai': return `${year}/${monthName}`;
            case '2025/mai/26': return `${year}/${monthName}/${day}`;
            case '2025/2025-05/2025-05-26': return `${year}/${year}-${month}/${year}-${month}-${day}`;
            case '2025 mai 26': return `${year} ${monthName} ${day}`;
            case '20250526': return `${year}${month}${day}`;
            default: return `${year}/${month}/${day}`;
        }
    }

    /**
     * Join path components safely
     * @param {string} basePath - Base path
     * @param {...string} parts - Path parts to join
     * @returns {string} Combined path
     */
    joinPath(basePath, ...parts) {
        if (typeof require !== 'undefined') {
            const path = require('path');
            return path.join(basePath, ...parts);
        } else {
            // Browser fallback
            const allParts = [basePath, ...parts].filter(part => part && part.length > 0);
            return allParts.join('/').replace(/\/+/g, '/');
        }
    }

    /**
     * Ensure directory exists
     * @param {string} dirPath - Directory path
     * @returns {Promise<boolean>} Success status
     */
    async ensureDirectory(dirPath) {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            try {
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
                return true;
            } catch (error) {
                console.error('Failed to create directory:', dirPath, error);
                return false;
            }
        }
        return true; // Browser environments can't create directories
    }

    /**
     * Get display name for this destination
     * @returns {string} Display name
     */
    getDisplayName() {
        return this.type;
    }

    /**
     * Check if this destination is ready to process files
     * @returns {boolean} Ready status
     */
    isReady() {
        return this.enabled;
    }

    /**
     * Cleanup resources
     * Called when processing is complete or cancelled
     * @returns {Promise<void>}
     */
    async cleanup() {
        // Default implementation does nothing
        // Subclasses can override if needed
    }

    /**
     * Get processing priority
     * Lower numbers = higher priority
     * @returns {number} Priority value
     */
    getPriority() {
        return 100; // Default priority
    }
} 