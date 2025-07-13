const { CloudService } = require('./cloud-service.js');

/**
 * Azure Blob Storage Cloud Service
 * Handles Azure Blob Storage specific configuration and validation
 */
class AzureBlobService extends CloudService {
    constructor() {
        super('azure-blob');
        this.connectionString = '';
        this.containerName = '';
    }

    /**
     * Get service configuration
     * @returns {Object} Service configuration object
     */
    toConfig() {
        return {
            ...super.toConfig(),
            connectionString: this.connectionString,
            containerName: this.containerName
        };
    }

    /**
     * Load configuration from object
     * @param {Object} config - Configuration object
     */
    fromConfig(config) {
        super.fromConfig(config);
        this.connectionString = config.connectionString || '';
        this.containerName = config.containerName || '';
    }

    /**
     * Validate service configuration
     * @returns {boolean} True if configuration is valid
     */
    isValid() {
        return this.enabled && this.connectionString && this.containerName;
    }

    /**
     * Get display information for UI
     * @returns {Object} Display information
     */
    getDisplayInfo() {
        return {
            ...super.getDisplayInfo(),
            name: 'Azure Blob Storage',
            containerName: this.containerName,
            hasCredentials: !!this.connectionString
        };
    }
}

module.exports = { AzureBlobService }; 