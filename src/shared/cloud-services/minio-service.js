const { CloudService } = require('./cloud-service.js');

/**
 * MinIO Cloud Service
 * Handles MinIO (S3-compatible) specific configuration and validation
 */
class MinioService extends CloudService {
    constructor() {
        super('minio');
        this.endpoint = '';
        this.accessKey = '';
        this.secretKey = '';
        this.bucket = '';
        this.region = 'us-east-1'; // Default region for MinIO
        this.useSSL = true;
        this.port = 9000;
    }

    /**
     * Get service configuration
     * @returns {Object} Service configuration object
     */
    toConfig() {
        return {
            ...super.toConfig(),
            endpoint: this.endpoint,
            accessKey: this.accessKey,
            secretKey: this.secretKey,
            bucket: this.bucket,
            region: this.region,
            useSSL: this.useSSL,
            port: this.port
        };
    }

    /**
     * Load configuration from object
     * @param {Object} config - Configuration object
     */
    fromConfig(config) {
        super.fromConfig(config);
        this.endpoint = config.endpoint || '';
        this.accessKey = config.accessKey || '';
        this.secretKey = config.secretKey || '';
        this.bucket = config.bucket || '';
        this.region = config.region || 'us-east-1';
        this.useSSL = config.useSSL !== undefined ? config.useSSL : true;
        this.port = config.port || 9000;
    }

    /**
     * Validate service configuration
     * @returns {boolean} True if configuration is valid
     */
    isValid() {
        return this.enabled && this.endpoint && this.accessKey && this.secretKey && this.bucket;
    }

    /**
     * Get display information for UI
     * @returns {Object} Display information
     */
    getDisplayInfo() {
        return {
            ...super.getDisplayInfo(),
            name: 'MinIO',
            endpoint: this.endpoint,
            bucket: this.bucket,
            region: this.region,
            useSSL: this.useSSL,
            port: this.port,
            hasCredentials: !!(this.accessKey && this.secretKey)
        };
    }

    /**
     * Validate specific configuration fields
     * @returns {Object} Validation result with { valid: boolean, errors: string[] }
     */
    validate() {
        const errors = [];
        
        if (!this.endpoint) {
            errors.push('MinIO endpoint is required');
        } else if (!this.endpoint.match(/^[a-zA-Z0-9.-]+$/)) {
            errors.push('Invalid MinIO endpoint format');
        }
        
        if (!this.bucket) {
            errors.push('MinIO bucket name is required');
        } else if (!this.bucket.match(/^[a-z0-9.-]+$/)) {
            errors.push('Invalid MinIO bucket name format');
        }
        
        if (!this.accessKey) {
            errors.push('MinIO access key is required');
        }
        
        if (!this.secretKey) {
            errors.push('MinIO secret key is required');
        }

        if (this.port && (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535)) {
            errors.push('MinIO port must be a valid port number (1-65535)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = { MinioService }; 