const { ConfigManager } = require('../services/config-manager.js');
const sharedConfig = require('../../shared/config.js');

let configManager;

/**
 * Initialize configuration manager
 * @returns {ConfigManager} ConfigManager instance
 */
function initializeConfigManager() {
    const serverUrl = sharedConfig.serverBaseUrl;
    configManager = new ConfigManager(serverUrl);
    
    console.log(`ConfigManager initialized for server: ${serverUrl}`);
    console.log(`Hostname: ${configManager.getHostname()}`);
    console.log(`Configuration directory: ${configManager.getConfigPath()}`);
    
    return configManager;
}

/**
 * Get the current config manager instance
 * @returns {ConfigManager} Config manager instance
 */
function getConfigManager() {
    if (!configManager) {
        throw new Error('ConfigManager not initialized. Call initializeConfigManager() first.');
    }
    return configManager;
}

/**
 * Check if ConfigManager is initialized
 * @returns {boolean} True if ConfigManager is initialized
 */
function isConfigManagerInitialized() {
    return configManager !== undefined;
}

/**
 * Get configuration value
 * @param {string} section - Configuration section
 * @returns {any} Configuration value
 */
function getConfig(section) {
    return getConfigManager().get(section);
}

/**
 * Set configuration value
 * @param {string} section - Configuration section
 * @param {any} value - Value to set
 */
function setConfig(section, value) {
    const manager = getConfigManager();
    manager.set(section, value);
    manager.saveConfiguration();
}

/**
 * Get cloud service configuration
 * @param {string} serviceType - Cloud service type
 * @returns {CloudService|null} Cloud service instance
 */
function getCloudService(serviceType) {
    return getConfigManager().getCloudService(serviceType);
}

/**
 * Update cloud service configuration
 * @param {string} serviceType - Service type
 * @param {Object} serviceConfig - Service configuration
 */
function updateCloudService(serviceType, serviceConfig) {
    return getConfigManager().updateCloudService(serviceType, serviceConfig);
}

/**
 * Get all enabled cloud services
 * @returns {Array<CloudService>} Enabled cloud services
 */
function getEnabledCloudServices() {
    return getConfigManager().getEnabledCloudServices();
}

/**
 * Get all cloud services with display info
 * @returns {Object} Cloud services with display info
 */
function getCloudServicesDisplayInfo() {
    return getConfigManager().getCloudServicesDisplayInfo();
}

/**
 * Validate all cloud service configurations
 * @returns {Object} Validation results
 */
function validateCloudServices() {
    return getConfigManager().validateCloudServices();
}

/**
 * Migrate data from localStorage
 * @param {Object} localStorageData - Data from localStorage
 */
async function migrateFromLocalStorage(localStorageData) {
    return getConfigManager().migrateFromLocalStorage(localStorageData);
}

/**
 * Check if migration is needed
 * @returns {boolean} True if migration is needed
 */
function needsMigration() {
    return getConfigManager().needsMigration();
}

/**
 * Get configuration file path
 * @returns {string} Config file path
 */
function getConfigPath() {
    return getConfigManager().getConfigPath();
}

/**
 * Get server hostname
 * @returns {string} Server hostname
 */
function getHostname() {
    return getConfigManager().getHostname();
}

/**
 * Get server URL
 * @returns {string} Server URL
 */
function getServerUrl() {
    return getConfigManager().getServerUrl();
}

/**
 * Export configuration for debugging
 * @returns {Object} Full configuration object
 */
function exportConfig() {
    return getConfigManager().exportConfig();
}

module.exports = {
    initializeConfigManager,
    getConfigManager,
    isConfigManagerInitialized,
    getConfig,
    setConfig,
    getCloudService,
    updateCloudService,
    getEnabledCloudServices,
    getCloudServicesDisplayInfo,
    validateCloudServices,
    migrateFromLocalStorage,
    needsMigration,
    getConfigPath,
    getHostname,
    getServerUrl,
    exportConfig
}; 