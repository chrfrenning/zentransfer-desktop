/**
 * Base CloudService class
 * All cloud service implementations inherit from this
 */
class CloudService {
    constructor(serviceType) {
        this.serviceType = serviceType;
        this.enabled = false;
    }

    /**
     * Get service configuration
     * @returns {Object} Service configuration object
     */
    toConfig() {
        return {
            serviceType: this.serviceType,
            enabled: this.enabled
        };
    }

    /**
     * Load configuration from object
     * @param {Object} config - Configuration object
     */
    fromConfig(config) {
        this.enabled = config.enabled || false;
    }

    /**
     * Validate service configuration
     * @returns {boolean} True if configuration is valid
     */
    isValid() {
        return true; // Base implementation always valid
    }

    /**
     * Get display information for UI
     * @returns {Object} Display information
     */
    getDisplayInfo() {
        return {
            name: this.serviceType,
            enabled: this.enabled
        };
    }
}

module.exports = { CloudService }; 