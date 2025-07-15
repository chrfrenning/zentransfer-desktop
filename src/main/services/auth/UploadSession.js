const { app } = require('electron');
const logger = require('../../utils/Logger.js');

class UploadSession {
    constructor() {
        this.serverUrl = app.globals.serverBaseUrl;
        this.appName = app.globals.appName;
        this.clientId = app.globals.clientId;
        this.appVersion = app.globals.appVersion;

        this.session = null;
    }

    async createUploadSession() {
        logger.info('Creating ZenTransfer upload session');

        const postData = JSON.stringify({
            app_name: this.settings.appName,
            app_version: this.settings.appVersion,
            client_id: this.settings.clientId
        });
        
        if ( app.tokenManager.isTokenExpired(token) ) {
            await app.tokenManager.performTokenRefresh();
        }

        const token = await app.tokenManager.getToken();

        const response = await this._fetch(`${this.serverUrl}/api/upload/startsession`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            body: postData
        });

        if (!response.ok) {
            throw new Error(`Failed to create upload session: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        this.session = {
            parentId: data.parent_id,
            uploadUrl: data.upload_url,
            expiresAt: new Date(data.expires_at)
        };

        logger.info('ZenTransfer upload session created', { parentId: session.parentId });
        return this.session;
    }

    async isSessionExpired(session) {
        if (this.session) {
            if ( this.session.expiresAt < Date.now() ) {
                return true;
            }
        }
        return false;
    }

    async getUploadUrl() {
        if (this.isSessionExpired()) {
            await this.createUploadSession();
        }
        return this.session.uploadUrl;
    }
}

module.exports = { UploadSession };