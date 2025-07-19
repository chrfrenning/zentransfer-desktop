/**
 * Main Process Token Manager
 * Handles JWT token storage, validation, and refresh in the main process
 * Provides centralized token management for workers and IPC
 */

const { BrowserWindow } = require('electron');
const logger = require('../../utils/Logger.js');

class TokenManager {
    constructor(configManager, authService) {
        this.configManager = configManager;
        this.authService = authService;
        this.refreshTimer = null;
        this.isRefreshing = false;
        this.refreshPromise = null;
        
        // Token refresh configuration
        this.refreshConfig = {
            checkInterval: 2 * 60 * 1000, // Check every 2 minutes
            refreshThreshold: 10 * 60 * 1000, // Refresh when 10 minutes remain
            maxRetries: 3,
            retryDelay: 5000 // 5 seconds
        };

        this.performTokenRefresh().then((token) => {
            logger.info('MainTokenManager: Token refreshed successfully');
            this.startTokenRefreshTimer();
        });
        
        logger.info('MainTokenManager initialized');
    }
    
    /**
     * Get a valid token (refresh if needed)
     * @returns {Promise<string|null>} Valid token or null
     */
    async getValidToken() {
        logger.info('MainTokenManager: Getting valid token...');
        
        const token = await this.getToken();
        if (!token) {
            logger.info('MainTokenManager: No token found in config');
            return null;
        }
        
        logger.info('MainTokenManager: Token found, checking validity...');
        
        // Check if token is expired
        if (this.isTokenExpired(token)) {
            logger.info('MainTokenManager: Token is expired, attempting refresh...');
            const refreshed = await this.performTokenRefresh();
            if (refreshed) {
                logger.info('MainTokenManager: Token refreshed successfully');
                return refreshed;
            } else {
                logger.info('MainTokenManager: Token refresh failed, returning null');
                return null;
            }
        }
        
        // Check if token is expiring soon and needs refresh
        if (this.isTokenExpiringSoon(token, 10)) {
            logger.info('MainTokenManager: Token expiring soon, attempting refresh...');
            const refreshed = await this.performTokenRefresh();
            if (refreshed) {
                logger.info('MainTokenManager: Token refreshed successfully');
                return refreshed;
            } else {
                logger.info('MainTokenManager: Token refresh failed, but current token still valid, returning current token');
                // If refresh fails but current token is still valid, return it
                return token;
            }
        }
        
        logger.info('MainTokenManager: Token is valid, returning current token');
        return token;
    }
    
    /**
     * Ensure we have a valid token, refreshing if necessary
     * @returns {Promise<string|null>} Valid token or null
     */
    async ensureValidToken() {
        // If already refreshing, wait for that to complete
        if (this.isRefreshing && this.refreshPromise) {
            try {
                return await this.refreshPromise;
            } catch (error) {
                console.error('Failed to wait for token refresh:', error);
                return null;
            }
        }
        
        // Start refresh process
        this.isRefreshing = true;
        this.refreshPromise = this.performTokenRefresh();
        
        try {
            const result = await this.refreshPromise;
            return result;
        } catch (error) {
            console.error('Token refresh failed:', error);
            return null;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }
    
    /**
     * Perform the actual token refresh
     * @returns {Promise<string|null>} Refreshed token or null
     */
    async performTokenRefresh() {
        const currentToken = await this.getToken();
        if (!currentToken) {
            return null;
        }
        
        // Log token expiration details
        try {
            const tokenInfo = this.decodeToken(currentToken);
            if (tokenInfo) {
                const expiresAt = new Date(tokenInfo.expires_at);
                const now = new Date();
                const timeUntilExpiry = expiresAt - now;
                logger.info(`MainTokenManager: Token expires at ${expiresAt.toISOString()}, time until expiry: ${timeUntilExpiry}ms`);
            }
        } catch (error) {
            logger.info('MainTokenManager: Could not decode token for expiration info:', error.message);
        }
        
        try {
            logger.info('MainTokenManager: Calling auth service to refresh token...');
            logger.info('MainTokenManager: Token being sent for refresh:', currentToken ? `${currentToken.substring(0, 20)}...` : 'null');
            
            const refreshResult = await this.authService.refreshToken(currentToken);
            
            if (refreshResult.success && refreshResult.token) {
                // Save the new token
                const currentEmail = await this.getEmail();
                await this.saveToken(refreshResult.token, currentEmail);
                
                logger.info('MainTokenManager: Token refreshed successfully');
                this.notifyRendererTokenUpdated(refreshResult.token);
                
                return refreshResult.token;
            } else {
                logger.info('MainTokenManager: Token refresh failed:', refreshResult.error);
                
                // Check if this is a server error (5xx) vs authentication error (4xx)
                if (refreshResult.error && refreshResult.error.includes('HTTP error 5')) {
                    logger.info('MainTokenManager: Server error during refresh, keeping current token');
                    // Don't clear token on server errors - server might be temporarily down
                    return null;
                } else {
                    logger.info('MainTokenManager: Authentication error during refresh, clearing token');
                    // Clear token only on authentication errors (4xx)
                    await this.clearToken();
                    this.notifyRendererTokenCleared();
                    return null;
                }
            }
        } catch (error) {
            console.error('MainTokenManager: Token refresh error:', error);
            
            // Check if this is a network error vs authentication error
            if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('500')) {
                logger.info('MainTokenManager: Network/server error during refresh, keeping current token');
                // Don't clear token on network/server errors
                return null;
            } else {
                logger.info('MainTokenManager: Authentication error during refresh, clearing token');
                // Clear token only on authentication errors
                await this.clearToken();
                this.notifyRendererTokenCleared();
                return null;
            }
        }
    }
    
    /**
     * Validate token with server
     * @param {string} token - Token to validate
     * @returns {Promise<boolean>} True if valid
     */
    async validateTokenWithServer(token) {
        try {
            logger.info('MainTokenManager: Validating token with server...');
            logger.info('MainTokenManager: Token being validated:', token ? `${token.substring(0, 20)}...` : 'null');
            
            const isValid = await this.authService.verifyToken(token);
            
            if (isValid) {
                logger.info('MainTokenManager: Token is valid on server');
                return true;
            } else {
                logger.info('MainTokenManager: Token is invalid on server, attempting refresh...');
                
                // Try to refresh the token
                const newToken = await this.ensureValidToken();
                return newToken !== null;
            }
        } catch (error) {
            console.error('MainTokenManager: Token validation failed:', error);
            return false;
        }
    }
    
    /**
     * Save token to config
     * @param {string} token - Token to save
     * @param {string} userEmail - User email
     * @returns {Promise<boolean>} Success status
     */
    async saveToken(token, userEmail = null) {
        try {
            logger.info('MainTokenManager: Saving token and email to config...');
            
            // Log token expiration details when saving
            try {
                const tokenInfo = this.decodeToken(token);
                if (tokenInfo) {
                    const expiresAt = new Date(tokenInfo.expires_at);
                    const now = new Date();
                    const timeUntilExpiry = expiresAt - now;
                    logger.info(`MainTokenManager: Saving token that expires at ${expiresAt.toISOString()}, time until expiry: ${timeUntilExpiry}ms`);
                    
                    if (timeUntilExpiry <= 0) {
                        console.warn('MainTokenManager: WARNING - Token is already expired!');
                    } else if (timeUntilExpiry < 60000) { // Less than 1 minute
                        console.warn(`MainTokenManager: WARNING - Token expires very soon (${Math.round(timeUntilExpiry/1000)}s)`);
                    }
                }
            } catch (error) {
                logger.info('MainTokenManager: Could not decode token for expiration info:', error.message);
            }
            
            this.configManager.set('authToken', token);
            
            if (userEmail) {
                this.configManager.set('email', userEmail);
                logger.info('MainTokenManager: Email saved:', userEmail);
            }
            
            this.configManager.saveConfiguration();
            logger.info('MainTokenManager: Token saved successfully to config and persisted');
            
            // Verify the token was saved correctly
            const savedToken = this.configManager.get('authToken');
            if (savedToken === token) {
                logger.info('MainTokenManager: Token verification successful');
            } else {
                console.error('MainTokenManager: Token verification failed - saved token does not match');
            }
            
            return true;
        } catch (error) {
            console.error('MainTokenManager: Failed to save token:', error);
            return false;
        }
    }
    
    /**
     * Get token from config
     * @returns {Promise<string|null>} Token or null
     */
    async getToken() {
        try {
            const token = this.configManager.get('authToken');
            if (token) {
                //logger.info('MainTokenManager: Retrieved token from config:', 'present');
                //logger.info('MainTokenManager: Token preview:', token ? `${token.substring(0, 20)}...` : 'null');
                return token;
            } else {
                logger.info('MainTokenManager: Retrieved token from config:', 'null');
                return null;
            }
        } catch (error) {
            console.error('MainTokenManager: Failed to get token from config:', error);
            return null;
        }
    }
    
    /**
     * Get email from config
     * @returns {Promise<string|null>} Email or null
     */
    async getEmail() {
        try {
            return this.configManager.get('email') || null;
        } catch (error) {
            console.error('Failed to get email from config:', error);
            return null;
        }
    }
    
    /**
     * Clear token from config
     * @returns {Promise<void>}
     */
    async clearToken() {
        try {
            this.configManager.set('authToken', '');
            this.configManager.saveConfiguration();
            logger.info('Token cleared from config (email preserved)');
        } catch (error) {
            console.error('Failed to clear token from config:', error);
        }
    }
    
    /**
     * Clear all auth data
     * @returns {Promise<void>}
     */
    async clearAll() {
        try {
            this.configManager.set('authToken', '');
            this.configManager.set('email', '');
            this.configManager.saveConfiguration();
            logger.info('Token and email cleared from config');
        } catch (error) {
            console.error('Failed to clear token and email from config:', error);
        }
    }
    
    /**
     * Check if token is expired
     * @param {string} token - Token to check
     * @returns {boolean} True if expired
     */
    isTokenExpired(token) {
        const expirationTime = this.getTokenExpiration(token);
        if (!expirationTime) {
            return true;
        }
        
        // Add a 5-second buffer to prevent immediate expiration timing issues
        const bufferMs = 5000;
        return Date.now() >= (expirationTime - bufferMs);
    }
    
    /**
     * Check if token is expiring soon
     * @param {string} token - Token to check
     * @param {number} minutesThreshold - Minutes threshold (default: 10)
     * @returns {boolean} True if expiring soon
     */
    isTokenExpiringSoon(token, minutesThreshold = 10) {
        const expirationTime = this.getTokenExpiration(token);
        if (!expirationTime) {
            return true;
        }
        
        const thresholdTime = minutesThreshold * 60 * 1000;
        return (expirationTime - Date.now()) <= thresholdTime;
    }
    
    /**
     * Get token expiration time
     * @param {string} token - Token to check
     * @returns {number|null} Expiration time in milliseconds or null
     */
    getTokenExpiration(token) {
        try {
            const payload = this.decodeToken(token);
            if (!payload || !payload.expires_at) {
                return null;
            }
            
            // expires_at is an ISO datetime string, convert to milliseconds
            return new Date(payload.expires_at).getTime();
        } catch (error) {
            console.error('Failed to get token expiration:', error);
            return null;
        }
    }
    
    /**
     * Get time until token expires
     * @param {string} token - Token to check
     * @returns {number} Time in milliseconds until expiry (0 if expired)
     */
    getTimeUntilExpiry(token) {
        const expirationTime = this.getTokenExpiration(token);
        if (!expirationTime) {
            return 0;
        }
        
        const timeRemaining = expirationTime - Date.now();
        return Math.max(0, timeRemaining);
    }
    
    /**
     * Decode JWT token
     * @param {string} token - Token to decode
     * @returns {Object|null} Decoded payload or null
     */
    decodeToken(token) {
        try {
            //console.log('Decoding token:', token);
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT token format');
            }
            
            const payload = parts[1];
            const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
            const decodedPayload = Buffer.from(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
            
            return JSON.parse(decodedPayload);
        } catch (error) {
            console.error('Failed to decode JWT token:', error);
            return null;
        }
    }
    
    /**
     * Get token info for display
     * @returns {Promise<Object>} Token information
     */
    async getTokenInfo() {
        const token = await this.getToken();
        const email = await this.getEmail();
        
        return {
            token: token,
            email: email,
            isValid: token ? !this.isTokenExpired(token) : false,
            timeRemaining: token ? this.getTimeUntilExpiry(token) : 0,
            expiringSoon: token ? this.isTokenExpiringSoon(token) : true
        };
    }
    
    /**
     * Start background token refresh timer
     */
    startTokenRefreshTimer() {
        if (this.refreshTimer) {
            this.stopTokenRefreshTimer();
        }
        
        this.refreshTimer = setInterval(async () => {
            try {
                const token = await this.getToken();
                if (!token) {
                    logger.info('No token found, stopping refresh timer');
                    this.stopTokenRefreshTimer();
                    return;
                }
                
                // Check if token needs refresh
                if (this.isTokenExpiringSoon(token, 10)) {
                    logger.info('Token expiring soon, attempting background refresh...');
                    await this.ensureValidToken();
                }
            } catch (error) {
                console.error('Error during background token refresh:', error);
            }
        }, this.refreshConfig.checkInterval);
        
        logger.info('Token refresh timer started');
    }
    
    /**
     * Stop background token refresh timer
     */
    stopTokenRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            logger.info('Token refresh timer stopped');
        }
    }
    
    /**
     * Notify renderer processes of token update
     * @param {string} token - Updated token
     */
    notifyRendererTokenUpdated(token) {
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach(window => {
            window.webContents.send('auth-token-updated', { token });
        });
    }
    
    /**
     * Notify renderer processes of token cleared
     */
    notifyRendererTokenCleared() {
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach(window => {
            window.webContents.send('auth-token-cleared');
        });
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        this.stopTokenRefreshTimer();
        this.isRefreshing = false;
        this.refreshPromise = null;
    }
}

module.exports = { TokenManager }; 