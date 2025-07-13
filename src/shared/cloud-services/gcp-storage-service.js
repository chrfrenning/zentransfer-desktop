const { CloudService } = require('./cloud-service.js');

/**
 * Google Cloud Storage Cloud Service
 * Handles GCP Storage specific configuration and validation
 */
class GcpStorageService extends CloudService {
    constructor() {
        super('gcp-storage');
        this.bucketName = '';
        this.serviceAccountKey = '';
        this.projectId = '';
    }

    /**
     * Get service configuration
     * @returns {Object} Service configuration object
     */
    toConfig() {
        return {
            ...super.toConfig(),
            bucketName: this.bucketName,
            serviceAccountKey: this.serviceAccountKey,
            projectId: this.projectId
        };
    }

    /**
     * Load configuration from object
     * @param {Object} config - Configuration object
     */
    fromConfig(config) {
        super.fromConfig(config);
        this.bucketName = config.bucketName || '';
        this.serviceAccountKey = config.serviceAccountKey || '';
        this.projectId = config.projectId || '';
    }

    /**
     * Validate service configuration
     * @returns {boolean} True if configuration is valid
     */
    isValid() {
        return this.enabled && this.bucketName && this.serviceAccountKey;
    }

    /**
     * Get display information for UI
     * @returns {Object} Display information
     */
    getDisplayInfo() {
        return {
            ...super.getDisplayInfo(),
            name: 'Google Cloud Storage',
            bucketName: this.bucketName,
            projectId: this.projectId,
            hasCredentials: !!this.serviceAccountKey
        };
    }
}

module.exports = { GcpStorageService }; 