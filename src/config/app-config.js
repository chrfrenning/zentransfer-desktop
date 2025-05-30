/**
 * Application Configuration
 * Centralized configuration for the ZenTransfer app
 */

// Load version from package.json with fallback for different path contexts
let packageJson;
try {
    // Try different possible paths for package.json
    packageJson = require('../../package.json');
} catch (e1) {
    try {
        const path = require('path');
        packageJson = require(path.join(__dirname, '../../package.json'));
    } catch (e2) {
        try {
            packageJson = require('../../../package.json');
        } catch (e3) {
            // Fallback version
            packageJson = { version: '0.1.15' };
        }
    }
}

// Inline environment detection for renderer process
function getIsDevelopment() {
    // Check Node.js environment variable first (highest priority)
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
        return true;
    }
    
    // Check for --dev command line argument
    if (typeof process !== 'undefined' && process.argv && process.argv.includes('--dev')) {
        return true;
    }
    
    // Check browser environment (for renderer process)
    if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
        return true;
    }
    
    // Default to production for safety
    return false;
}

// Calculate development mode
const isDevelopment = getIsDevelopment();

// Server configuration
const SERVER_CONFIG = {
    development: 'https://tmp.chph.dev',
    production: 'https://zentransfer.io'
};

export const config = {
    // Server settings
    SERVER_BASE_URL: isDevelopment ? SERVER_CONFIG.development : SERVER_CONFIG.production,
    
    // App metadata
    APP_NAME: 'com.chph.zentransfer',
    APP_VERSION: packageJson.version,
    CLIENT_ID: '4a276465-fbc2-4874-833d-966bd48c3ace',
    
    // Environment
    IS_DEVELOPMENT: isDevelopment,
    isDevelopment,
    
    // UI settings
    ANIMATION_DURATION: 300,
    NOTIFICATION_TIMEOUT: 5000,
    
    // Upload settings
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    CHUNK_SIZE: 1024 * 1024, // 1MB chunks
    MAX_CONCURRENT_UPLOADS: 3, // Now implemented with worker pool
    
    // Worker pool settings
    UPLOAD_WORKER_POOL_SIZE: 3,
    
    // Token settings
    TOKEN_REFRESH_THRESHOLD: 5, // minutes before expiry
    TOKEN_CHECK_INTERVAL: 2 * 60 * 1000, // 2 minutes
    
    // External URLs
    URLS: {
        REGISTER: 'https://zentransfer.io/register',
        HELP: 'https://zentransfer.io/blog/zentransfer-app-help',
        PRIVACY: 'https://zentransfer.io/privacy-policy',
        TERMS: 'https://zentransfer.io/terms-of-service'
    }
}; 