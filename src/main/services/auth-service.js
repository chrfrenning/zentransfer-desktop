/**
 * Main Process Auth Service
 * Handles all authentication-related API calls in the main process
 * Moved from renderer LoginAPI for better security
 */

const sharedConfig = require('../../shared/config.js');

class MainAuthService {
    constructor(configManager) {
        this.configManager = configManager;
        this.serverBaseUrl = sharedConfig.serverBaseUrl;
        this.appName = sharedConfig.appName;
        this.appVersion = sharedConfig.appVersion;
        this.clientId = sharedConfig.clientId;
        
        console.log(`MainAuthService initialized for server: ${this.serverBaseUrl}`);
        console.log(`MainAuthService: app_name=${this.appName}, app_version=${this.appVersion}, client_id=${this.clientId}`);
    }
    
    /**
     * Initialize login process
     * @param {string} email - User email
     * @param {string} deviceId - Device ID
     * @returns {Promise<Object>} Login initialization response
     */
    async initialize(email, deviceId) {
        try {
            const response = await fetch(`${this.serverBaseUrl}/login/initialize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    cid: deviceId,
                    app_name: this.appName,
                    app_version: this.appVersion,
                    client_id: this.clientId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Login initialization successful');
            return data;
        } catch (error) {
            console.error('Login initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Finalize login process
     * @param {string} sessionId - Session ID from initialization
     * @param {string} otp - One-time password
     * @returns {Promise<Object>} Login finalization response
     */
    async finalize(sessionId, otp) {
        try {
            const response = await fetch(`${this.serverBaseUrl}/login/finalize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    token: otp
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Login finalization successful');
            return data;
        } catch (error) {
            console.error('Login finalization failed:', error);
            throw error;
        }
    }
    
    /**
     * Verify token with server
     * @param {string} token - Token to verify
     * @returns {Promise<boolean>} True if token is valid
     */
    async verifyToken(token) {
        try {
            console.log('AuthService: Verifying token with server...');
            console.log('AuthService: Token being sent:', token ? `${token.substring(0, 20)}...` : 'null');
            
            const requestBody = {
                token: token,
                app_name: this.appName,
                app_version: this.appVersion,
                client_id: this.clientId
            };
            
            console.log('AuthService: Request body for /verify:', {
                token: token ? `${token.substring(0, 20)}...` : 'null',
                app_name: this.appName,
                app_version: this.appVersion,
                client_id: this.clientId
            });
            
            const response = await fetch(`${this.serverBaseUrl}/login/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            const isValid = response.status === 200;
            console.log(`AuthService: Token verification result: ${isValid ? 'valid' : 'invalid'} (status: ${response.status})`);
            return isValid;
        } catch (error) {
            console.error('AuthService: Token verification failed:', error);
            return false;
        }
    }
    
    /**
     * Refresh token
     * @param {string} token - Current token
     * @returns {Promise<Object>} Refresh result with success status and new token
     */
    async refreshToken(token) {
        try {
            console.log('AuthService: Refreshing token with server...');
            console.log('AuthService: Token being sent for refresh:', token ? `${token.substring(0, 20)}...` : 'null');
            
            const requestBody = {
                token: token,
                app_name: this.appName,
                app_version: this.appVersion,
                client_id: this.clientId
            };
            
            console.log('AuthService: Request body for /refresh:', {
                token: token ? `${token.substring(0, 20)}...` : 'null',
                app_name: this.appName,
                app_version: this.appVersion,
                client_id: this.clientId
            });
            
            const response = await fetch(`${this.serverBaseUrl}/login/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log('AuthService: Token refresh failed with status:', response.status);
                console.log('AuthService: Error response:', errorText.substring(0, 200));
                return {
                    success: false,
                    error: `HTTP error ${response.status}: ${errorText}`
                };
            }
            
            const data = await response.json();
            
            if (data.result === 'ok' && data.token) {
                console.log('AuthService: Token refresh successful');
                console.log('AuthService: New token received:', data.token ? `${data.token.substring(0, 20)}...` : 'null');
                return {
                    success: true,
                    token: data.token,
                    result: data.result
                };
            } else {
                console.log('AuthService: Token refresh failed:', data.message);
                return {
                    success: false,
                    error: data.message || 'Token refresh failed'
                };
            }
        } catch (error) {
            console.error('AuthService: Token refresh failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get current server configuration
     * @returns {Object} Server configuration
     */
    getServerConfig() {
        return {
            serverBaseUrl: this.serverBaseUrl,
            appName: this.appName,
            appVersion: this.appVersion,
            clientId: this.clientId
        };
    }
    
    /**
     * Update server configuration (useful for testing different environments)
     * @param {Object} config - New configuration
     */
    updateServerConfig(config) {
        if (config.serverBaseUrl) this.serverBaseUrl = config.serverBaseUrl;
        if (config.appName) this.appName = config.appName;
        if (config.appVersion) this.appVersion = config.appVersion;
        if (config.clientId) this.clientId = config.clientId;
        
        console.log(`Auth service configuration updated: ${this.serverBaseUrl}`);
    }
    
    /**
     * Test server connectivity
     * @returns {Promise<boolean>} True if server is reachable
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.serverBaseUrl}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const isConnected = response.ok;
            console.log(`Server connectivity test: ${isConnected ? 'connected' : 'failed'}`);
            return isConnected;
        } catch (error) {
            console.error('Server connectivity test failed:', error);
            return false;
        }
    }
}

module.exports = { MainAuthService }; 