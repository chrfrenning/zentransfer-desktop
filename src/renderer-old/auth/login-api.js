/**
 * Login API Client (Renderer)
 * Wrapper around main process auth service
 * All authentication API calls now handled in main process for better security
 */

export class LoginAPI {
    /**
     * Initialize login process
     * @param {string} email - User email
     * @param {string} deviceId - Device ID
     * @returns {Promise<Object>} Login initialization response
     */
    static async initialize(email, deviceId) {
        try {
            const result = await window.electronAPI.auth.loginInitialize(email, deviceId);
            if (result.success) {
                return result.result;
            } else {
                throw new Error(result.error);
            }
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
    static async finalize(sessionId, otp) {
        try {
            const result = await window.electronAPI.auth.loginFinalize(sessionId, otp);
            if (result.success) {
                return result.result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Login finalization failed:', error);
            throw error;
        }
    }
    
    /**
     * Verify token with server
     * @param {string} token - Token to verify
     * @returns {Promise<boolean>} True if valid
     */
    static async verify(token) {
        try {
            const result = await window.electronAPI.auth.validateToken(token);
            if (result.success) {
                return result.isValid;
            } else {
                console.error('Token verification failed:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }
    
    /**
     * Refresh token (deprecated - use TokenManager.refreshToken instead)
     * @param {string} token - Token to refresh
     * @returns {Promise<Object>} Refresh result
     */
    static async refresh(token) {
        try {
            const result = await window.electronAPI.auth.refreshToken();
            if (result.success) {
                return {
                    result: 'ok',
                    token: result.token
                };
            } else {
                return {
                    result: 'error',
                    message: result.error
                };
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            return {
                result: 'error',
                message: error.message
            };
        }
    }
    
    /**
     * Test server connection
     * @returns {Promise<boolean>} True if connected
     */
    static async testConnection() {
        try {
            const result = await window.electronAPI.auth.testConnection();
            if (result.success) {
                return result.isConnected;
            } else {
                console.error('Connection test failed:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
    
    /**
     * Get server configuration
     * @returns {Promise<Object>} Server configuration
     */
    static async getServerConfig() {
        try {
            const result = await window.electronAPI.auth.getServerConfig();
            if (result.success) {
                return result.config;
            } else {
                console.error('Failed to get server config:', result.error);
                return null;
            }
        } catch (error) {
            console.error('Failed to get server config:', error);
            return null;
        }
    }
} 