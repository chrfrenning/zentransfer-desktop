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
            app_name: this.appName,
            app_version: this.appVersion,
            client_id: this.clientId
        });

        const token = await app.tokenManager.getToken();
        
        if ( app.tokenManager.isTokenExpired(token) ) {
            await app.tokenManager.performTokenRefresh();
        }

        const response = await fetch(`${this.serverUrl}/api/upload/startsession`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
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
            token: data.token,
            expiresAt: new Date(data.expires_at)
        };

        logger.info('ZenTransfer upload session created', { parentId: this.session.parentId });
        return this.session;
    }

    async isSessionExpired(session) {
        if (this.session) {

            const now = Date.now();
            const safetyMarginMinutes = 60;
            const safetyMargin = safetyMarginMinutes * 60 * 1000;
            const expiresAt = this.session.expiresAt.getTime();
            const expiresAtWithSafetyMargin = expiresAt - safetyMargin;

            if ( expiresAtWithSafetyMargin < now ) {
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