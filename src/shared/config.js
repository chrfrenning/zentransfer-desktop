/**
 * Shared Configuration
 * This file can be used by both main process (Node.js) and renderer process
 */

/**
 * Determine if we're in development mode
 * This function works in both Node.js (main process) and browser (renderer process) environments
 * 
 * Priority order:
 * 1. NODE_ENV environment variable
 * 2. --dev command line argument 
 * 3. Browser location (localhost for renderer process)
 * 4. Default to production
 */
function getIsDevelopment() {
    let reason = '';
    
    // Check Node.js environment variable first (highest priority)
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
        reason = 'NODE_ENV=development';
        return { isDev: true, reason };
    }
    
    // Check for --dev command line argument
    if (typeof process !== 'undefined' && process.argv && process.argv.includes('--dev')) {
        reason = '--dev command line flag';
        return { isDev: true, reason };
    }
    
    // Check browser environment (for renderer process)
    if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
        reason = 'localhost detected in browser';
        return { isDev: true, reason };
    }
    
    // Check for explicit production setting
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
        reason = 'NODE_ENV=production';
        return { isDev: false, reason };
    }
    
    // Default to production for safety
    reason = 'default (no dev indicators found)';
    return { isDev: false, reason };
}

// Server configuration
const SERVER_URLS = {
    development: 'https://tmp.chph.dev',
    production: 'https://zentransfer.io'
};

const sharedConfig = {
    // App metadata
    APP_NAME: 'com.chph.zentransfer',
    CLIENT_ID: '4a276465-fbc2-4874-833d-966bd48c3ace',

    // Server settings
    serverBaseUrl: getIsDevelopment().isDev ? SERVER_URLS.development : SERVER_URLS.production,
    
    // Development mode flag (for backward compatibility)
    isDevelopment: getIsDevelopment().isDev
};

module.exports = sharedConfig;