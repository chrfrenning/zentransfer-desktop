/**
 * Base Upload Service
 * Abstract class that defines the interface for all upload services
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class UploadServiceBase extends EventEmitter {
    constructor(settings) {
        super();

        this.settings = { ...settings };
        
        if (this.constructor === UploadServiceBase) {
            throw new Error('UploadServiceBase is abstract and cannot be instantiated directly');
        }
    }



    /* Service information */

    getServiceName() {
        throw new Error('getServiceName() must be implemented by subclass');
    }

    validateConfiguration() {
        throw new Error('validateConfiguration() must be implemented by subclass');
    }

    async testConnection() {
        throw new Error('testConnection() must be implemented by subclass');
    }



    /* File operations on the service */

    async uploadFile(filePath, remoteName, mimeType, options = {}) {
        console.log("!!!--------- Should not get here -------!!!");
        console.log(`${filePath} -> ${remoteName}/${mimeType}: ${JSON.stringify(options)}`);
        throw new Error('uploadFile() must be implemented by subclass');
    }
    
    async listFiles(path = '') {
        throw new Error('listFiles() is not implemented for this service');
    }
    
    async downloadFile(filename, localPath) {
        throw new Error('downloadFile() is not implemented for this service');
    }
    
    async createShareableUrl(filename, expiresAt) {
        throw new Error('createShareableUrl() is not implemented for this service');
    }

    async doesFileExist(filename) {
        throw new Error('doesFileExist() is not implemented for this service');
    }



    /* Event handlers */

    _emitProgress(bytesTransferred, totalBytes) {
        this.emit('progress', bytesTransferred, totalBytes);
    }

    _emitComplete() {
        this.emit('complete');
    }

    _emitError(error) {
        this.emit('error', error);
    }



    /* Internal helper methods for subclasses */
    
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