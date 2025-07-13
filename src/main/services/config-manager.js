const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Import the shared configuration class
const { SharedConfiguration } = require('../../shared/configuration/shared-configuration.js');

/**
 * ConfigManager class
 * Manages file-based configuration with hostname-based directory structure
 */
class ConfigManager {
    constructor(serverUrl) {
        this.userDataPath = app.getPath('userData');
        this.serverUrl = serverUrl;
        this.hostname = this.extractHostname(serverUrl);
        this.configurationPath = path.join(this.userDataPath, 'Configuration');
        this.serverConfigPath = path.join(this.configurationPath, this.hostname);
        this.configFilePath = path.join(this.serverConfigPath, 'config.json');
        this.globalSettingsPath = path.join(this.userDataPath, 'global-settings.json');
        
        // Ensure directories exist
        this.ensureDirectories();
        
        // Load configuration
        this.config = new SharedConfiguration();
        this.loadConfiguration();
    }

    /**
     * Extract hostname from server URL
     * @param {string} serverUrl - Server URL
     * @returns {string} Hostname
     */
    extractHostname(serverUrl) {
        try {
            const url = new URL(serverUrl);
            return url.hostname;
        } catch (error) {
            console.error('Invalid server URL:', serverUrl, error);
            return 'default';
        }
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const directories = [
            this.userDataPath,
            this.configurationPath,
            this.serverConfigPath,
            path.join(this.serverConfigPath, 'logs')
        ];

        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        });
    }

    /**
     * Load configuration from file
     */
    loadConfiguration() {
        try {
            if (fs.existsSync(this.configFilePath)) {
                const configData = fs.readFileSync(this.configFilePath, 'utf8');
                const parsedConfig = JSON.parse(configData);
                this.config.fromConfig(parsedConfig);
                console.log(`Configuration loaded for ${this.hostname}`);
            } else {
                console.log(`No existing configuration found for ${this.hostname}, using defaults`);
                this.saveConfiguration(); // Save default configuration
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
            // Keep default configuration if loading fails
        }
    }

    /**
     * Save configuration to file
     */
    saveConfiguration() {
        try {
            const configData = this.config.toConfig();
            fs.writeFileSync(this.configFilePath, JSON.stringify(configData, null, 2), 'utf8');
            console.log(`Configuration saved for ${this.hostname}`);
        } catch (error) {
            console.error('Failed to save configuration:', error);
            throw error;
        }
    }

    /**
     * Get configuration for specific section
     * @param {string} section - Configuration section (dot notation supported)
     * @returns {any} Configuration value
     */
    get(section) {
        if (!section) {
            return this.config.toConfig();
        }

        const parts = section.split('.');
        let value = this.config;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    /**
     * Set configuration value
     * @param {string} section - Configuration section (dot notation supported)
     * @param {any} value - Value to set
     */
    set(section, value) {
        const parts = section.split('.');
        let current = this.config;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current) || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }
        
        current[parts[parts.length - 1]] = value;
    }

    /**
     * Get cloud service configuration
     * @param {string} serviceType - Cloud service type
     * @returns {CloudService|null} Cloud service instance
     */
    getCloudService(serviceType) {
        return this.config.getCloudService(serviceType);
    }

    /**
     * Update cloud service configuration
     * @param {string} serviceType - Service type
     * @param {Object} serviceConfig - Service configuration
     */
    updateCloudService(serviceType, serviceConfig) {
        this.config.updateCloudService(serviceType, serviceConfig);
        this.saveConfiguration();
    }

    /**
     * Get all enabled cloud services
     * @returns {Array<CloudService>} Enabled cloud services
     */
    getEnabledCloudServices() {
        return this.config.getEnabledCloudServices();
    }

    /**
     * Get all cloud services with display info
     * @returns {Object} Cloud services with display info
     */
    getCloudServicesDisplayInfo() {
        return this.config.getCloudServicesDisplayInfo();
    }

    /**
     * Validate all cloud service configurations
     * @returns {Object} Validation results
     */
    validateCloudServices() {
        return this.config.validateCloudServices();
    }

    /**
     * Migrate data from localStorage (one-time migration)
     * @param {Object} localStorageData - Data from localStorage
     */
    async migrateFromLocalStorage(localStorageData) {
        console.log('Starting migration from localStorage...');
        
        try {
            // Migrate basic settings
            if (localStorageData.zentransfer_download_path) {
                this.set('downloadPath', localStorageData.zentransfer_download_path);
            }
            
            if (localStorageData.zentransfer_last_sync_time) {
                this.set('lastSyncTime', parseInt(localStorageData.zentransfer_last_sync_time));
            }
            
            // Migrate auth token
            if (localStorageData.zentransfer_auth_token) {
                this.set('authToken', localStorageData.zentransfer_auth_token);
            }
            
            if (localStorageData.zentransfer_token_metadata) {
                this.set('tokenMetadata', JSON.parse(localStorageData.zentransfer_token_metadata));
            }
            
            // Migrate preferences
            if (localStorageData.zentransfer_preferences) {
                const preferences = JSON.parse(localStorageData.zentransfer_preferences);
                
                // Migrate cloud service settings
                if (preferences.awsS3Enabled !== undefined) {
                    const awsService = this.getCloudService('aws-s3');
                    if (awsService) {
                        awsService.enabled = preferences.awsS3Enabled;
                        awsService.region = preferences.awsS3Region || '';
                        awsService.bucket = preferences.awsS3Bucket || '';
                        awsService.accessKey = preferences.awsS3AccessKey || '';
                        awsService.secretKey = preferences.awsS3SecretKey || '';
                        awsService.storageClass = preferences.awsS3StorageTier || 'STANDARD';
                    }
                }
                
                if (preferences.azureEnabled !== undefined) {
                    const azureService = this.getCloudService('azure-blob');
                    if (azureService) {
                        azureService.enabled = preferences.azureEnabled;
                        azureService.connectionString = preferences.azureConnectionString || '';
                        azureService.containerName = preferences.azureContainer || '';
                    }
                }
                
                if (preferences.gcpEnabled !== undefined) {
                    const gcpService = this.getCloudService('gcp-storage');
                    if (gcpService) {
                        gcpService.enabled = preferences.gcpEnabled;
                        gcpService.bucketName = preferences.gcpBucket || '';
                        gcpService.serviceAccountKey = preferences.gcpServiceAccountKey || '';
                    }
                }
                
                // Migrate other preferences
                this.set('preferences.disableNotifications', preferences.disableNotifications);
                this.set('preferences.skipDuplicates', preferences.skipDuplicates);
            }
            
            // Migrate import settings
            const importKeys = [
                'zentransfer_import_path',
                'zentransfer_import_destination_path',
                'zentransfer_import_backup_path',
                'zentransfer_import_backup_enabled',
                'zentransfer_import_include_subdirectories',
                'zentransfer_import_organize_into_folders',
                'zentransfer_import_folder_organization_type',
                'zentransfer_import_custom_folder_name',
                'zentransfer_import_date_format',
                'zentransfer_import_skip_duplicates'
            ];
            
            importKeys.forEach(key => {
                if (localStorageData[key]) {
                    let configKey = key.replace('zentransfer_', '');
                    let value = localStorageData[key];
                    
                    // Parse boolean values
                    if (value === 'true' || value === 'false') {
                        value = value === 'true';
                    }
                    
                    if (configKey.startsWith('import_')) {
                        const importSettingKey = configKey.replace('import_', '');
                        this.set(`importSettings.${importSettingKey}`, value);
                    } else {
                        this.set(configKey, value);
                    }
                }
            });
            
            // Save migrated configuration
            this.saveConfiguration();
            console.log('Migration completed successfully');
            
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
    }

    /**
     * Check if migration is needed
     * @returns {boolean} True if migration is needed
     */
    needsMigration() {
        return !fs.existsSync(this.configFilePath);
    }

    /**
     * Get configuration file path for this server
     * @returns {string} Config file path
     */
    getConfigPath() {
        return this.configFilePath;
    }

    /**
     * Get server hostname
     * @returns {string} Server hostname
     */
    getHostname() {
        return this.hostname;
    }

    /**
     * Get server URL
     * @returns {string} Server URL
     */
    getServerUrl() {
        return this.serverUrl;
    }

    /**
     * Export configuration for debugging
     * @returns {Object} Full configuration object
     */
    exportConfig() {
        return this.config.toConfig();
    }

    /**
     * Clear all configuration (for testing/cleanup)
     */
    clearConfiguration() {
        this.config = new SharedConfiguration();
        this.saveConfiguration();
    }
}

module.exports = { ConfigManager }; 