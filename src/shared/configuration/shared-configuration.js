const { AwsS3Service } = require('../cloud-services/aws-s3-service.js');
const { AzureBlobService } = require('../cloud-services/azure-blob-service.js');
const { GcpStorageService } = require('../cloud-services/gcp-storage-service.js');

/**
 * SharedConfiguration class
 * Manages all application configuration including cloud services
 */
class SharedConfiguration {
    constructor() {
        // User preferences
        this.preferences = {
            disableNotifications: true,
            skipDuplicates: false
        };

        // Application settings
        this.downloadPath = '';
        this.importPath = '';
        this.importDestinationPath = '';
        this.importBackupPath = '';
        this.importBackupEnabled = false;
        this.lastSyncTime = null;

        // Authentication
        this.authToken = '';
        this.tokenMetadata = {};
        this.deviceId = '';

        // Cloud services
        this.cloudServices = {
            'aws-s3': new AwsS3Service(),
            'azure-blob': new AzureBlobService(),
            'gcp-storage': new GcpStorageService()
        };

        // Import settings
        this.importSettings = {
            includeSubdirectories: true,
            organizeIntoFolders: false,
            folderOrganizationType: 'date',
            customFolderName: '',
            dateFormat: 'YYYY-MM-DD',
            uploadEnabled: false,
            uploadToAwsS3: false,
            uploadToAzure: false,
            uploadToGcp: false,
            enableCloudUpload: false
        };
    }

    /**
     * Export configuration to JSON-serializable object
     * @returns {Object} Configuration object
     */
    toConfig() {
        const cloudServicesConfig = {};
        for (const [key, service] of Object.entries(this.cloudServices)) {
            cloudServicesConfig[key] = service.toConfig();
        }

        return {
            preferences: this.preferences,
            downloadPath: this.downloadPath,
            importPath: this.importPath,
            importDestinationPath: this.importDestinationPath,
            importBackupPath: this.importBackupPath,
            importBackupEnabled: this.importBackupEnabled,
            lastSyncTime: this.lastSyncTime,
            authToken: this.authToken,
            tokenMetadata: this.tokenMetadata,
            deviceId: this.deviceId,
            cloudServices: cloudServicesConfig,
            importSettings: this.importSettings,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Load configuration from object
     * @param {Object} config - Configuration object
     */
    fromConfig(config) {
        this.preferences = { ...this.preferences, ...(config.preferences || {}) };
        this.downloadPath = config.downloadPath || '';
        this.importPath = config.importPath || '';
        this.importDestinationPath = config.importDestinationPath || '';
        this.importBackupPath = config.importBackupPath || '';
        this.importBackupEnabled = config.importBackupEnabled || false;
        this.lastSyncTime = config.lastSyncTime || null;
        this.authToken = config.authToken || '';
        this.tokenMetadata = config.tokenMetadata || {};
        this.deviceId = config.deviceId || '';
        this.importSettings = { ...this.importSettings, ...(config.importSettings || {}) };

        // Load cloud services
        if (config.cloudServices) {
            for (const [key, serviceConfig] of Object.entries(config.cloudServices)) {
                if (this.cloudServices[key]) {
                    this.cloudServices[key].fromConfig(serviceConfig);
                }
            }
        }
    }

    /**
     * Get cloud service by type
     * @param {string} serviceType - Service type
     * @returns {CloudService|null} Cloud service instance
     */
    getCloudService(serviceType) {
        return this.cloudServices[serviceType] || null;
    }

    /**
     * Get all enabled cloud services
     * @returns {Array<CloudService>} Array of enabled cloud services
     */
    getEnabledCloudServices() {
        return Object.values(this.cloudServices).filter(service => service.enabled);
    }

    /**
     * Update cloud service configuration
     * @param {string} serviceType - Service type
     * @param {Object} config - Service configuration
     */
    updateCloudService(serviceType, config) {
        const service = this.getCloudService(serviceType);
        if (service) {
            service.fromConfig(config);
        }
    }

    /**
     * Get all cloud services with their display info
     * @returns {Object} Cloud services with display info
     */
    getCloudServicesDisplayInfo() {
        const displayInfo = {};
        for (const [key, service] of Object.entries(this.cloudServices)) {
            displayInfo[key] = service.getDisplayInfo();
        }
        return displayInfo;
    }

    /**
     * Validate all cloud service configurations
     * @returns {Object} Validation results
     */
    validateCloudServices() {
        const validation = {};
        for (const [key, service] of Object.entries(this.cloudServices)) {
            validation[key] = {
                isValid: service.isValid(),
                enabled: service.enabled
            };
        }
        return validation;
    }
}

module.exports = { SharedConfiguration }; 