/**
 * Application Configuration
 * Centralized configuration for the ZenTransfer app
 */

export const config = {
    // Server settings
    SERVER_BASE_URL: null, // we don't know yet
    
    // App metadata
    APP_NAME: null,
    APP_VERSION: null, // Will be null until set by IPC
    CLIENT_ID: null,
    
    // Environment
    IS_DEVELOPMENT: false, // we don't know yet
    
    // UI settings
    NOTIFICATION_TIMEOUT: 5000,
    
    // Upload settings
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    
    // External URLs
    URLS: {
        REGISTER: 'https://zentransfer.io/register',
        HELP: 'https://zentransfer.io/blog/zentransfer-app-help',
        PRIVACY: 'https://zentransfer.io/privacy-policy',
        TERMS: 'https://zentransfer.io/terms-of-service'
    },
    
    // Method to set version from IPC
    setVersion: (version) => {
        config.APP_VERSION = version;
        console.log(`Config version updated to: ${version}`);
    }
}; 