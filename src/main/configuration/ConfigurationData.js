const { AWSConfiguration } = require('./clouds/AWSConfiguration.js');
const { AzureConfiguration } = require('./clouds/AzureConfiguration.js');
const { GoogleConfiguration } = require('./clouds/GoogleConfiguration.js');
const { MinioConfiguration } = require('./clouds/MinioConfiguration.js');
const { UUIDGenerator } = require('../utils/UUIDGenerator.js');

/**
 * SharedConfiguration class
 * Manages all application configuration including cloud services
 */
class ConfigurationData {
    constructor() {
        this.meta = {
            version: '1'
        };

        // User preferences
        this.preferences = {
            skipExisting: true,
            skipDuplicates: false,
            createHighWaterMark: false,
            createPreviews: false,              // Generate preview and thumbnails for cloud stores
            extractMetaData: false,             // Extract metadata and save as json in cloud stores
            createIndexFiles: false,            // Generate json indexes of uploaded files
            publicUrlsInIndexes: false,         // Include public urls in indexes
            thumbnailSize: 400,                 // Thumbnail size in pixels
            thumbnailQuality: 90,               // Thumbnail quality (0-100)
            previewSize: 1920,                  // Preview size in pixels
            previewQuality: 90                  // Preview quality (0-100)
        };

        // Download settings
        this.downloadSettings = {
            downloadPath: '',
            lastSyncTime: null,
            isDownloadEnabled: false,
            retryOn404: false,
            maxRetries: 5,
            // Server polling settings with exponential backoff
            downloadBackoff: {
                initialInterval: 1000,          // 1 second (immediate responsiveness)
                maxInterval: 1800000,           // 30 minutes (1800 seconds)
                multiplier: 2.0,                // Double interval each time
                resetOnActivity: true           // Reset backoff on UI activity
            }
        };

        // Authentication
        this.authToken = '';
        this.email = '';
        this.deviceId = UUIDGenerator.generateGUID();

        // Cloud services
        this.cloudServices = {
            'aws-s3': new AWSConfiguration(),
            'azure-blob': new AzureConfiguration(),
            'gcp-storage': new GoogleConfiguration(),
            'minio': new MinioConfiguration()
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
            importTypeFilter: 'allFiles',
            importTimeFilter: 'allTime',
            
            // Upload settings
            uploadEnabled: false,
            uploadToAwsS3: false,
            uploadToAzure: false,
            uploadToGcp: false,
            uploadToMinio: false,
            enableCloudUpload: false,

            // Operational settings
            autoStartJobInSecs: 60
        };

        // Upload settings (for upload screen preferences)
        this.uploadSettings = {
            lastSelectedService: 'zentransfer', // Default to ZenTransfer
            fileBackoff: { // Backoff for individual files to avoid retrying same over and over again and blocking others
                initialInterval: 5000,    // 5 seconds
                maxInterval: 300000,      // 5 minutes
                multiplier: 2.0,          // Double each time
                resetOnSuccess: true
            },
            serviceBackoff: { // Backoff for services to avoid rate limiting or excessive errors when svc is down
                initialInterval: 1000,    // 1 seconds
                maxInterval: 1800000,     // 30 minutes
                multiplier: 2.0,          // Double each time
                resetOnSuccess: true
            },
            maxRetries: 5
        };

        // Worker pools
        this.workerPools = {
            uploadWorkerPoolSize: 3,
            importWorkerPoolSize: 3,
            downloadWorkerPoolSize: 3
        };

        // Autosort
        this.autoSort = {
            enabled: false,
            enableFolderSort: false,
            folderPrompt: '',
            enableMetaData: false,
            metaDataPrompt: '',
            apiKeyOpenAI: '',
            model: 'gpt-4o',
            maxRetries: 3,
            temperature: 0.5,
            maxTokens: 2500
        }

        // Signatures
        this.signWithCertificate = {
            enabled: false,
            certificate: '',
            certificatePassword: '',
            enableC2PA: false
        }

        this.signWithPGP = {
            enabled: false,
            pgpKey: '',
            pgpKeyPassword: ''
        }

        // Ledger
        this.ledger = {
            enabled: false,
            complexityBits: 8,
            publicLinks: true
        }

        // Last used folders
        this.lastUsedFolders = {
            sourceFolders: [],
            destinationFolders: []
        }
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
            meta: this.meta,
            preferences: this.preferences,
            downloadSettings: this.downloadSettings,
            authToken: this.authToken,
            email: this.email,
            deviceId: this.deviceId,
            cloudServices: cloudServicesConfig,
            importSettings: this.importSettings,
            uploadSettings: this.uploadSettings,
            autoSort: this.autoSort,
            signWithCertificate: this.signWithCertificate,
            signWithPGP: this.signWithPGP,
            ledger: this.ledger,
            lastUsedFolders: this.lastUsedFolders,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Load configuration from object
     * @param {Object} config - Configuration object
     */
    fromConfig(config) {
        this.meta = { ...this.meta, ...(config.meta || {}) };
        this.preferences = { ...this.preferences, ...(config.preferences || {}) };
        this.downloadSettings = { ...this.downloadSettings, ...config.downloadSettings };
        
        this.authToken = config.authToken || '';
        this.email = config.email || '';
        this.deviceId = config.deviceId || this.deviceId || UUIDGenerator.generateGUID();

        this.importSettings = { ...this.importSettings, ...config.importSettings };
        this.uploadSettings = { ...this.uploadSettings, ...config.uploadSettings };

        // Load cloud services
        if (config.cloudServices) {
            for (const [key, serviceConfig] of Object.entries(config.cloudServices)) {
                if (this.cloudServices[key]) {
                    this.cloudServices[key].fromConfig(serviceConfig);
                }
            }
        }

        this.autoSort = { ...this.autoSort, ...config.autoSort };
        this.signWithCertificate = { ...this.signWithCertificate, ...config.signWithCertificate };
        this.signWithPGP = { ...this.signWithPGP, ...config.signWithPGP };
        this.ledger = { ...this.ledger, ...config.ledger };
        this.lastUsedFolders = { ...this.lastUsedFolders, ...config.lastUsedFolders };
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

module.exports = { ConfigurationData };