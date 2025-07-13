/**
 * Base Upload Service
 * Abstract class that defines the interface for all upload services
 */

class UploadServiceBase {
    /**
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

    /**
     * Get the service name
     * @returns {string} Service name
     */
    getServiceName() {
        throw new Error('getServiceName() must be implemented by subclass');
    }

    /**
     * Validate the service configuration
     * @returns {Object} Validation result with { valid: boolean, errors: string[] }
     */
    validateConfiguration() {
        throw new Error('validateConfiguration() must be implemented by subclass');
    }

    /**
     * Test the connection to the service
     * @returns {Promise<Object>} Test result with { success: boolean, message: string, details?: any }
     */
    async testConnection() {
        throw new Error('testConnection() must be implemented by subclass');
    }

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
     * Get upload progress (if supported)
     * @param {string} uploadId - Upload identifier
     * @returns {Promise<Object>} Progress info with { progress: number, status: string }
     */
    async getUploadProgress(uploadId) {
        return { progress: 0, status: 'not_supported' };
    }

    /**
     * Cancel an upload (if supported)
     * @param {string} uploadId - Upload identifier
     * @returns {Promise<boolean>} True if cancelled successfully
     */
    async cancelUpload(uploadId) {
        return false;
    }

    /**
     * Update service settings
     * @param {Object} newSettings - New settings to merge
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.isConfigured = false;
        this.lastTestResult = null;
        this.lastTestTime = null;
    }

    /**
     * Get current settings (sanitized - no sensitive data)
     * @returns {Object} Sanitized settings
     */
    getSettings() {
        return this.sanitizeSettings(this.settings);
    }

    /**
     * Sanitize settings to remove sensitive data for logging/display
     * @param {Object} settings - Settings to sanitize
     * @returns {Object} Sanitized settings
     */
    sanitizeSettings(settings) {
        const sanitized = { ...settings };
        
        // Remove common sensitive fields
        const sensitiveFields = [
            'password', 'secret', 'key', 'token', 'accessKey', 'secretKey', 
            'connectionString', 'privateKey', 'serviceAccountKey'
        ];
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    /**
     * Check if the service is properly configured
     * @returns {boolean} True if configured
     */
    isServiceConfigured() {
        if (!this.isConfigured) {
            const validation = this.validateConfiguration();
            this.isConfigured = validation.valid;
        }
        return this.isConfigured;
    }

    /**
     * Get the last test result
     * @returns {Object|null} Last test result or null if never tested
     */
    getLastTestResult() {
        return this.lastTestResult;
    }

    /**
     * Check if a recent test was successful
     * @param {number} maxAgeMs - Maximum age of test result in milliseconds (default: 5 minutes)
     * @returns {boolean} True if recent test was successful
     */
    hasRecentSuccessfulTest(maxAgeMs = 5 * 60 * 1000) {
        if (!this.lastTestResult || !this.lastTestTime) {
            return false;
        }
        
        const age = Date.now() - this.lastTestTime;
        return this.lastTestResult.success && age < maxAgeMs;
    }

    /**
     * Store test result
     * @param {Object} result - Test result
     * @protected
     */
    _storeTestResult(result) {
        this.lastTestResult = result;
        this.lastTestTime = Date.now();
    }

    /**
     * Generate a unique upload ID
     * @returns {string} Unique upload ID
     * @protected
     */
    _generateUploadId() {
        return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validate file path and get file info
     * @param {string} filePath - File path to validate
     * @returns {Promise<Object>} File info with { exists: boolean, size: number, name: string }
     * @protected
     */
    async _validateFilePath(filePath) {
        // This will need to be implemented differently for browser vs Node.js
        if (typeof require !== 'undefined') {
            // Node.js environment (Electron main process)
            const fs = require('fs').promises;
            const path = require('path');
            
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
        } else {
            // Browser environment - file validation would be different
            throw new Error('File validation in browser environment not implemented');
        }
    }

    /**
     * Read file content
     * @param {string} filePath - File path to read
     * @returns {Promise<Buffer|ArrayBuffer>} File content
     * @protected
     */
    async _readFile(filePath) {
        if (typeof require !== 'undefined') {
            // Node.js environment
            const fs = require('fs').promises;
            return await fs.readFile(filePath);
        } else {
            // Browser environment
            throw new Error('File reading in browser environment not implemented');
        }
    }

    /**
     * Log service activity
     * @param {string} level - Log level (info, warn, error)
     * @param {string} message - Log message
     * @param {Object} details - Additional details
     * @protected
     */
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

    /**
     * Environment-aware fetch implementation
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     * @protected
     */
    async _fetch(url, options = {}) {
        if (typeof fetch !== 'undefined') {
            // Modern Node.js (18+) or browser environment
            return fetch(url, options);
        } else {
            // Fallback for older Node.js versions
            throw new Error('Fetch not available. Please use Node.js 18+ or implement HTTP client fallback.');
        }
    }

    /**
     * Create form data for file uploads
     * @param {Buffer|ArrayBuffer} fileContent - File content
     * @param {string} filename - File name
     * @param {string} mimeType - MIME type
     * @param {Object} additionalFields - Additional form fields
     * @returns {FormData|Object} Form data object
     * @protected
     */
    _createFormData(fileContent, filename, mimeType, additionalFields = {}) {
        if (typeof FormData !== 'undefined' && typeof Blob !== 'undefined') {
            // Browser environment
            const formData = new FormData();
            formData.append('file', new Blob([fileContent], { type: mimeType }), filename);
            
            Object.entries(additionalFields).forEach(([key, value]) => {
                formData.append(key, value);
            });
            
            return formData;
        } else if (typeof require !== 'undefined') {
            // Node.js environment - would need form-data package
            try {
                const FormData = require('form-data');
                const form = new FormData();
                form.append('file', fileContent, {
                    filename: filename,
                    contentType: mimeType
                });
                
                Object.entries(additionalFields).forEach(([key, value]) => {
                    form.append(key, value);
                });
                
                return form;
            } catch (error) {
                // form-data package not available
                this._log('warn', 'form-data package not available, using manual multipart construction');
                return this._createManualFormData(fileContent, filename, mimeType, additionalFields);
            }
        } else {
            throw new Error('FormData not available in this environment');
        }
    }

    /**
     * Create multipart form data manually (fallback)
     * @param {Buffer} fileContent - File content
     * @param {string} filename - File name
     * @param {string} mimeType - MIME type
     * @param {Object} additionalFields - Additional form fields
     * @returns {Object} Manual form data with boundary
     * @protected
     */
    _createManualFormData(fileContent, filename, mimeType, additionalFields = {}) {
        const boundary = `----formdata-zentransfer-${Date.now()}`;
        const parts = [];

        // Add file part
        parts.push(`--${boundary}`);
        parts.push(`Content-Disposition: form-data; name="file"; filename="${filename}"`);
        parts.push(`Content-Type: ${mimeType}`);
        parts.push('');
        parts.push(fileContent);

        // Add additional fields
        Object.entries(additionalFields).forEach(([key, value]) => {
            parts.push(`--${boundary}`);
            parts.push(`Content-Disposition: form-data; name="${key}"`);
            parts.push('');
            parts.push(value);
        });

        parts.push(`--${boundary}--`);

        return {
            boundary,
            body: Buffer.concat(parts.map(part => 
                Buffer.isBuffer(part) ? part : Buffer.from(part + '\r\n', 'utf8')
            )),
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            }
        };
    }

    /**
     * Check if running in Node.js environment
     * @returns {boolean} True if Node.js environment
     * @protected
     */
    _isNodeEnvironment() {
        return typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node;
    }

    /**
     * Check if running in browser environment
     * @returns {boolean} True if browser environment
     * @protected
     */
    _isBrowserEnvironment() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    /**
     * Get environment info
     * @returns {Object} Environment information
     * @protected
     */
    _getEnvironmentInfo() {
        return {
            isNode: this._isNodeEnvironment(),
            isBrowser: this._isBrowserEnvironment(),
            hasFormData: typeof FormData !== 'undefined',
            hasFetch: typeof fetch !== 'undefined',
            hasBlob: typeof Blob !== 'undefined'
        };
    }
}

module.exports = { UploadServiceBase };