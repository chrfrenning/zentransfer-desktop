/* ZenTransfer Global Constants */
const { app } = require('electron');

// Server configuration
const SERVER_URLS = {
    development: 'https://tmp.chph.dev',
    production: 'https://zentransfer.io'
};

class ZenTransferGlobals {
    constructor(isDevelopmentMode) {
        this.appName = 'com.chph.zentransfer';
        this.clientId = '4a276465-fbc2-4874-833d-966bd48c3ace';
        this.appVersion = app.getVersion();

        // Server settings
        this.serverBaseUrl = isDevelopmentMode ? SERVER_URLS.development : SERVER_URLS.production;

        // urls
        this.urls = {
            support: 'https://zentransfer.io/support',
            privacy: 'https://zentransfer.io/privacy-policy',
            terms: 'https://zentransfer.io/terms-of-service',
            download: 'https://zentransfer.io/download',
            donate: 'https://zentransfer.io/blog/supporting-the-zentransfer-app',
        }
    }
}

module.exports = { ZenTransferGlobals };