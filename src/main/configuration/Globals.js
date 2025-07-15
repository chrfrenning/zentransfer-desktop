/* ZenTransfer Global Constants */
const { app } = require('electron');

// Server configuration
const SERVER_URLS = {
    development: 'https://tmp.chph.dev',
    production: 'https://zentransfer.io'
};

const ZenTransferGlobals = {
    // CamelCase aliases for auth service
    appName: 'com.chph.zentransfer',
    clientId: '4a276465-fbc2-4874-833d-966bd48c3ace',
    appVersion: app.getVersion(),

    // Server settings
    serverBaseUrl: app.isDevelopmentMode ? SERVER_URLS.development : SERVER_URLS.production
};

module.exports = ZenTransferGlobals;