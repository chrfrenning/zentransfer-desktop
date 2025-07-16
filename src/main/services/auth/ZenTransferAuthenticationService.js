/**
 * Main Process Auth Service
 * Handles all authentication-related API calls in the main process
 * Moved from renderer LoginAPI for better security
 */

const sharedConfig = require('../../configuration/Globals.js');
const { AuthenticationServiceBase } = require('./AuthenticationServiceBase.js');
const logger = require('../../utils/Logger.js');

class ZenTransferAuthenticationService extends AuthenticationServiceBase {
    constructor(configManager) {
        super();
        
        this.configManager = configManager;
        this.serverBaseUrl = sharedConfig.serverBaseUrl;
        this.appName = sharedConfig.appName;
        this.appVersion = sharedConfig.appVersion;
        this.clientId = sharedConfig.clientId;
        
        logger.info(`MainAuthService initialized for server: ${this.serverBaseUrl}`);
        logger.info(`MainAuthService: app_name=${this.appName}, app_version=${this.appVersion}, client_id=${this.clientId}`);
    }
    
    /**
     * Initialize login process
     * @param {string} email - User email
     * @param {string} deviceId - Device ID
     * @returns {Promise<Object>} Login initialization response
     */
    async initialize(email, deviceId) {
        try {
            logger.info(`Initializing login for email: ${email} and deviceId: ${deviceId} on server: ${this.serverBaseUrl}`);
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
            logger.info('Login initialization successful');
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
            logger.info('Login finalization successful');
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
            logger.info('AuthService: Verifying token with server...');
            logger.info('AuthService: Token being sent:', token ? `${token.substring(0, 20)}...` : 'null');
            
            const requestBody = {
                token: token,
                app_name: this.appName,
                app_version: this.appVersion,
                client_id: this.clientId
            };
            
            logger.info('AuthService: Request body for /verify:', {
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
            logger.info(`AuthService: Token verification result: ${isValid ? 'valid' : 'invalid'} (status: ${response.status})`);
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
            logger.info('AuthService: Refreshing token with server...');
            logger.info('AuthService: Token being sent for refresh:', token ? `${token.substring(0, 20)}...` : 'null');
            
            const requestBody = {
                token: token,
                app_name: this.appName,
                app_version: this.appVersion,
                client_id: this.clientId
            };
            
            logger.silly('AuthService: Request body for /refresh:', {
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
                logger.info('AuthService: Token refresh failed with status:', response.status);
                logger.info('AuthService: Error response:', errorText.substring(0, 200));
                return {
                    success: false,
                    error: `HTTP error ${response.status}: ${errorText}`
                };
            }
            
            const data = await response.json();
            
            if (data.result === 'ok' && data.token) {
                logger.info('AuthService: Token refresh successful');
                logger.info('AuthService: New token received:', data.token ? `${data.token.substring(0, 20)}...` : 'null');
                return {
                    success: true,
                    token: data.token,
                    result: data.result
                };
            } else {
                logger.info('AuthService: Token refresh failed:', data.message);
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
     * Test server connectivity
     * @returns {Promise<boolean>} True if server is reachable
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.serverBaseUrl}/`, {
                method: 'HEAD',
                headers: {
                    'Accept': 'text/html',
                }
            });
            
            const isConnected = response.ok;
            logger.info(`Server connectivity test: ${isConnected ? 'connected' : 'failed'}`);
            return isConnected;
        } catch (error) {
            console.error('Server connectivity test failed:', error);
            return false;
        }
    }
}

module.exports = { ZenTransferAuthenticationService }; 