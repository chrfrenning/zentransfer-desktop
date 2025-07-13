/**
 * Upload Service Factory (Renderer Process)
 * Communicates with the main process upload service manager via IPC
 */

// IPC communication now handled through window.electronAPI

export class UploadServiceFactory {
    constructor() {
        this.activeService = null;
    }

    /**
     * Create or update a service instance
     * @param {string} serviceType - Type of service (zentransfer, aws-s3, azure-blob, gcp-storage)
     * @param {Object} settings - Service settings
     * @returns {Promise<Object>} Service info
     */
    async createService(serviceType, settings = {}) {
        const result = await window.electronAPI.uploadService.create(serviceType, settings);
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.serviceInfo;
    }

    /**
     * Test connection for a service
     * @param {string} serviceType - Type of service to test
     * @returns {Promise<Object>} Test result
     */
    async testService(serviceType) {
        const result = await window.electronAPI.uploadService.test(serviceType);
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.result;
    }

    /**
     * Update settings for an existing service
     * @param {string} serviceType - Type of service
     * @param {Object} newSettings - New settings to apply
     * @returns {Promise<Object>} Updated service info
     */
    async updateService(serviceType, newSettings) {
        const result = await window.electronAPI.uploadService.update(serviceType, newSettings);
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.serviceInfo;
    }

    /**
     * Set the active upload service
     * @param {string} serviceType - Type of service to set as active
     */
    setActiveService(serviceType) {
        this.activeService = serviceType;
    }

    /**
     * Get the active service type
     * @returns {string|null} Active service type or null if none set
     */
    getActiveServiceType() {
        return this.activeService;
    }

    /**
     * Get service display information
     * @param {string} serviceType - Type of service
     * @returns {Promise<Object>} Service display info
     */
    async getServiceDisplayInfo(serviceType) {
        const result = await window.electronAPI.uploadService.getDisplayInfo(serviceType);
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.displayInfo;
    }

    /**
     * Create services from user preferences
     * @param {Object} preferences - User preferences object
     * @returns {Promise<Array<Object>>} Array of created service info
     */
    async createServicesFromPreferences(preferences) {
        const result = await window.electronAPI.uploadService.createFromPreferences(preferences);
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.services;
    }

    /**
     * Get all configured services
     * @returns {Promise<Array<Object>>} Array of service info objects
     */
    async getAllServices() {
        const result = await window.electronAPI.uploadService.getAll();
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.services;
    }

    /**
     * Get available service types
     * @returns {Array<string>} Array of service type names
     */
    getAvailableServiceTypes() {
        return ['zentransfer', 'aws-s3', 'azure-blob', 'gcp-storage'];
    }
}

// Create a singleton instance for global use
export const uploadServiceFactory = new UploadServiceFactory(); 