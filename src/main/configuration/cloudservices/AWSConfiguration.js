const { CloudServiceConfiguration } = require('./CloudServiceConfiguration.js');

/**
 * AWS S3 Cloud Service
 * Handles AWS S3 specific configuration and validation
 */
class AWSConfiguration extends CloudServiceConfiguration {
    constructor() {
        super('aws-s3');
        this.region = '';
        this.bucket = '';
        this.accessKey = '';
        this.secretKey = '';
        this.storageClass = 'STANDARD';
    }

    /**
     * Get service configuration
     * @returns {Object} Service configuration object
     */
    toConfig() {
        return {
            ...super.toConfig(),
            region: this.region,
            bucket: this.bucket,
            accessKey: this.accessKey,
            secretKey: this.secretKey,
            storageClass: this.storageClass
        };
    }

    /**
     * Load configuration from object
     * @param {Object} config - Configuration object
     */
    fromConfig(config) {
        super.fromConfig(config);
        this.region = config.region || '';
        this.bucket = config.bucket || '';
        this.accessKey = config.accessKey || '';
        this.secretKey = config.secretKey || '';
        this.storageClass = config.storageClass || 'STANDARD';
    }

    /**
     * Validate service configuration
     * @returns {boolean} True if configuration is valid
     */
    isValid() {
        return this.enabled && this.region && this.bucket && this.accessKey && this.secretKey;
    }

    /**
     * Get display information for UI
     * @returns {Object} Display information
     */
    getDisplayInfo() {
        return {
            ...super.getDisplayInfo(),
            name: 'AWS S3',
            region: this.region,
            bucket: this.bucket,
            storageClass: this.storageClass,
            hasCredentials: !!(this.accessKey && this.secretKey)
        };
    }
}

module.exports = { AWSConfiguration }; 