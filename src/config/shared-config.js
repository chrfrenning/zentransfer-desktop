/**
 * Shared Configuration
 * This file can be used by both main process (Node.js) and renderer process
 */

// Load version from package.json
const path = require('path');
let packageJson;
try {
    packageJson = require(path.join(__dirname, '../../package.json'));
} catch (e) {
    // Fallback if package.json can't be loaded
    packageJson = { version: '0.1.15' };
}

// Server configuration
const SERVER_CONFIG = {
    development: 'https://tmp.chph.dev',
    production: 'https://zentransfer.io'
};

// App constants
const APP_NAME = 'com.chph.zentransfer';
const APP_VERSION = packageJson.version;
const CLIENT_ID = '4a276465-fbc2-4874-833d-966bd48c3ace';

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

// Calculate development mode
const { isDev, reason } = getIsDevelopment();
const isDevelopment = isDev;

// Log environment detection (only in Node.js environment to avoid browser console spam)
if (typeof process !== 'undefined' && typeof window === 'undefined') {
    console.log(`🔧 Environment: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} (${reason})`);
    console.log(`🌐 Server: ${isDevelopment ? SERVER_CONFIG.development : SERVER_CONFIG.production}`);
    console.log(`📦 Version: ${APP_VERSION}`);
}

const sharedConfig = {
    // Server settings
    SERVER_BASE_URL: isDevelopment ? SERVER_CONFIG.development : SERVER_CONFIG.production,
    
    // App metadata
    APP_NAME,
    APP_VERSION,
    CLIENT_ID,
    
    // Environment
    IS_DEVELOPMENT: isDevelopment,
    
    // Development mode flag (for backward compatibility)
    isDevelopment,
    
    // Environment detection details
    environmentReason: reason,
    
    // Helper function (simplified version for external use)
    getIsDevelopment: () => isDevelopment,
    
    // Detailed helper function
    getEnvironmentInfo: () => ({ isDevelopment, reason })
};

// Export for both CommonJS (Node.js) and ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = sharedConfig;
} else if (typeof window !== 'undefined') {
    window.sharedConfig = sharedConfig;
} 