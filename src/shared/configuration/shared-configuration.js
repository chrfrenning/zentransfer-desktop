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
        this.lastSyncTime = null;

        // Authentication
        this.authToken = '';
        this.email = '';
        this.deviceId = '';

        // Cloud services
        this.cloudServices = {
            'aws-s3': new AwsS3Service(),
            'azure-blob': new AzureBlobService(),
            'gcp-storage': new GcpStorageService()
        };

        // Import settings (consolidated all import-related settings here)
        this.importSettings = {
            // Path settings
            importPath: '',
            importDestinationPath: '',
            importBackupPath: '',
            importBackupEnabled: false,
            
            // Organization settings
            includeSubdirectories: true,
            organizeIntoFolders: false,
            folderOrganizationType: 'date',
            customFolderName: '',
            dateFormat: 'YYYY-MM-DD',
            
            // Upload settings
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
            lastSyncTime: this.lastSyncTime,
            authToken: this.authToken,
            email: this.email,
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
        this.lastSyncTime = config.lastSyncTime || null;
        this.authToken = config.authToken || '';
        this.email = config.email || '';
        this.deviceId = config.deviceId || '';

        // Load import settings with migration support
        let importSettings = { ...this.importSettings };
        
        // If importSettings exists in config, use it
        if (config.importSettings) {
            importSettings = { ...importSettings, ...config.importSettings };
        }
        
        // Migration: Check for old root-level import settings and move them
        if (config.importPath !== undefined) {
            importSettings.importPath = config.importPath;
            console.log('Migrating importPath from root level to importSettings');
        }
        if (config.importDestinationPath !== undefined) {
            importSettings.importDestinationPath = config.importDestinationPath;
            console.log('Migrating importDestinationPath from root level to importSettings');
        }
        if (config.importBackupPath !== undefined) {
            importSettings.importBackupPath = config.importBackupPath;
            console.log('Migrating importBackupPath from root level to importSettings');
        }
        if (config.importBackupEnabled !== undefined) {
            importSettings.importBackupEnabled = config.importBackupEnabled;
            console.log('Migrating importBackupEnabled from root level to importSettings');
        }
        
        this.importSettings = importSettings;

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
     * Get enabled cloud services
     * @returns {Array} Array of enabled cloud services
     */
    getEnabledCloudServices() {
        return Object.entries(this.cloudServices)
            .filter(([key, service]) => service.enabled)
            .map(([key, service]) => ({ type: key, service }));
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
     * Get display information for all cloud services
     * @returns {Array} Array of service display info
     */
    getCloudServicesDisplayInfo() {
        return Object.entries(this.cloudServices).map(([type, service]) => ({
            type,
            name: service.constructor.name.replace('Service', ''),
            enabled: service.enabled,
            configured: service.isConfigured()
        }));
    }

    /**
     * Validate all cloud services
     * @returns {Object} Validation results
     */
    validateCloudServices() {
        const results = {};
        for (const [type, service] of Object.entries(this.cloudServices)) {
            results[type] = service.validate();
        }
        return results;
    }
}

module.exports = { SharedConfiguration }; 