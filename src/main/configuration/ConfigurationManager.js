const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const logger = require('../utils/Logger.js');

// Import the configuration data class
const { ConfigurationData } = require('./ConfigurationData.js');

/**
 * ConfigurationManager class
 * 
 * Loads and saves our configuration data to disk
 * 
 */

class ConfigurationManager {
    constructor(serverUrl) {
        this.userDataPath = app.getPath('userData');
        this.serverUrl = serverUrl;
        this.hostname = this.extractHostname(serverUrl);
        this.configurationPath = path.join(this.userDataPath, 'Configuration');
        this.serverConfigPath = path.join(this.configurationPath, this.hostname);
        this.configFilePath = path.join(this.serverConfigPath, 'config.json');
        
        // Ensure directories exist
        this.ensureDirectories();
        
        // Load configuration
        this.config = new ConfigurationData();
        this.loadConfiguration();
    }

    extractHostname(serverUrl) {
        try {
            const url = new URL(serverUrl);
            return url.hostname;
        } catch (error) {
            console.error('Invalid server URL:', serverUrl, error);
            return 'default';
        }
    }

    ensureDirectories() {
        const directories = [
            this.userDataPath,
            this.configurationPath,
            this.serverConfigPath
        ];

        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.info(`Created directory: ${dir}`);
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
                logger.info(`Configuration loaded for ${this.hostname}`);
            } else {
                logger.info(`No existing configuration found for ${this.hostname}, using defaults`);
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
            logger.info(`Configuration saved for ${this.hostname}`);
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
        this.saveConfiguration();
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
        return this.config.getCloudSettingssDisplayInfo();
    }

    /**
     * Validate all cloud service configurations
     * @returns {Object} Validation results
     */
    validateCloudServices() {
        return this.config.validateCloudServices();
    }

    /**
     * Get configuration file path for this server
     * @returns {string} Config file path
     */
    getConfigFilename() {
        return this.configFilePath;
    }

    /**
     * Get configuration directory for this server
     * @returns {string} Path to configuration directory
     */
    getConfigDirectory() {
        return this.serverConfigPath;
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

module.exports = { ConfigurationManager }; 