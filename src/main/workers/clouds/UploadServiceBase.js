/**
 * Base Upload Service
 * Abstract class that defines the interface for all upload services
 */

const fs = require('fs').promises;
const path = require('path');

class UploadServiceBase {
    /**./UploadServiceBase.js
     * Create an upload service instance
     * @param {Object} settings - Service-specific settings
     */
    constructor(settings = {}) {
        if (this.constructor === UploadServiceBase) {
            throw new Error('UploadServiceBase is abstract and cannot be instantiated directly');
        }
        
        this.settings = { ...settings };
        this.isConfigured = false;
        this.lastTestResult = null;
        this.lastTestTime = null;
    }

    /* Service information */

    getServiceName() {
        throw new Error('getServiceName() must be implemented by subclass');
    }
    
    isServiceConfigured() {
        if (!this.isConfigured) {
            const validation = this.validateConfiguration();
            this.isConfigured = validation.valid;
        }
        return this.isConfigured;
    }

    validateConfiguration() {
        throw new Error('validateConfiguration() must be implemented by subclass');
    }



    /* Test the connection to the service */
    async testConnection() {
        throw new Error('testConnection() must be implemented by subclass');
    }



    /* File operations on the service */

    /**
     * Upload a file to the service
     * @param {string} filePath - Local file path
     * @param {string} remoteName - Remote file name/path
     * @param {string} mimeType - MIME type of the file
     * @param {Object} options - Additional upload options
     * @returns {Promise<Object>} Upload result with { success: boolean, url?: string, message: string, details?: any }
     */
    async uploadFile(filePath, remoteName, mimeType, options = {}) {
        throw new Error('uploadFile() must be implemented by subclass');
    }

    /**
     * List files in a given path
     * @param {string} path - Path to list files from (empty string for root)
     * @returns {Promise<Object>} List result with { success: boolean, files: Array<{name: string, size: number, modified: Date, isDirectory: boolean}>, message?: string }
     */
    async listFiles(path = '') {
        throw new Error('listFiles() is not implemented for this service');
    }

    /**
     * Download a file from the service
     * @param {string} filename - Name of the file to download
     * @param {string} localPath - Local path to save the file
     * @returns {Promise<Object>} Download result with { success: boolean, localPath?: string, message: string, details?: any }
     */
    async downloadFile(filename, localPath) {
        throw new Error('downloadFile() is not implemented for this service');
    }

    /**
     * Create a shareable URL with expiration
     * @param {string} filename - Name of the file to create URL for
     * @param {Date|number} expiresAt - Expiration date or timestamp
     * @returns {Promise<Object>} URL result with { success: boolean, url?: string, expiresAt?: Date, message: string, details?: any }
     */
    async createShareableUrl(filename, expiresAt) {
        throw new Error('createShareableUrl() is not implemented for this service');
    }

    async doesFileExist(filename) {
        throw new Error('doesFileExist() is not implemented for this service');
    }
    
    _generateUploadId() {
        return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    async _validateFilePath(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                exists: true,
                size: stats.size,
                name: path.basename(filePath),
                isFile: stats.isFile()
            };
        } catch (error) {
            return {
                exists: false,
                size: 0,
                name: '',
                isFile: false,
                error: error.message
            };
        }
    }
    
    async _readFile(filePath) {
        return await fs.readFile(filePath);
    }
    
    _log(level, message, details = {}) {
        const logEntry = {
            service: this.getServiceName(),
            level,
            message,
            timestamp: new Date().toISOString(),
            ...details
        };
        
        console[level](`[${this.getServiceName()}] ${message}`, details);
    }
    
    async _fetch(url, options = {}) {
        return fetch(url, options);
    }
}

module.exports = { UploadServiceBase };