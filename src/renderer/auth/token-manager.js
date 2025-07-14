/**
 * Token Manager (Renderer)
 * Simplified wrapper around main process token management
 * All authentication logic now handled in main process for better security
 */

import { JWTUtils } from './jwt-utils.js';

export class TokenManager {
    static TOKEN_KEY = 'zentransfer_auth_token';
    static TOKEN_METADATA_KEY = 'zentransfer_token_metadata';
    
    /**
     * Get a valid token (automatically refreshes if needed)
     * @returns {Promise<string|null>} Valid token or null
     */
    static async getValidToken() {
        try {
            const result = await window.electronAPI.auth.getValidToken();
            if (result.success) {
                return result.token;
            } else {
                console.error('Failed to get valid token:', result.error);
                return null;
            }
        } catch (error) {
            console.error('Failed to get valid token:', error);
            return null;
        }
    }
    
    /**
     * Save token to main process
     * @param {string} token - Token to save
     * @param {string} userEmail - User email
     * @returns {Promise<boolean>} Success status
     */
    static async saveToken(token, userEmail = null) {
        try {
            const result = await window.electronAPI.auth.saveToken(token, userEmail);
            if (result.success) {
                console.log('Token saved successfully');
                return true;
            } else {
                console.error('Failed to save token:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Failed to save token:', error);
            return false;
        }
    }
    
    /**
     * Get token from main process
     * @returns {Promise<string|null>} Token or null
     */
    static async getToken() {
        try {
            const result = await window.electronAPI.auth.getToken();
            if (result.success) {
                return result.token;
            } else {
                console.error('Failed to get token:', result.error);
                return null;
            }
        } catch (error) {
            console.error('Failed to get token:', error);
            return null;
        }
    }
    
    /**
     * Get email from main process
     * @returns {Promise<string|null>} Email or null
     */
    static async getEmail() {
        try {
            const result = await window.electronAPI.auth.getEmail();
            if (result.success) {
                return result.email;
            } else {
                console.error('Failed to get email:', result.error);
                return null;
            }
        } catch (error) {
            console.error('Failed to get email:', error);
            return null;
        }
    }
    
    /**
     * Check if token is valid (local check only)
     * @returns {Promise<boolean>} True if valid
     */
    static async isTokenValid() {
        try {
            const tokenInfo = await this.getTokenInfo();
            return tokenInfo.isValid;
        } catch (error) {
            console.error('Failed to validate token:', error);
            return false;
        }
    }

    /**
     * Check if token is expiring soon (local check only)
     * @param {number} minutesThreshold - Minutes threshold
     * @returns {Promise<boolean>} True if expiring soon
     */
    static async isTokenExpiringSoon(minutesThreshold = 5) {
        try {
            const tokenInfo = await this.getTokenInfo();
            if (!tokenInfo.token) {
                return true;
            }
            
            return JWTUtils.isTokenExpiringSoon(tokenInfo.token, minutesThreshold);
        } catch (error) {
            console.error('Failed to check token expiration:', error);
            return true;
        }
    }

    /**
     * Get time until token expires (local check only)
     * @returns {Promise<number>} Time in milliseconds
     */
    static async getTokenTimeRemaining() {
        try {
            const tokenInfo = await this.getTokenInfo();
            return tokenInfo.timeRemaining;
        } catch (error) {
            console.error('Failed to get token time remaining:', error);
            return 0;
        }
    }
    
    /**
     * Clear token from main process
     * @returns {Promise<void>}
     */
    static async clearToken() {
        try {
            const result = await window.electronAPI.auth.clearToken();
            if (result.success) {
                console.log('Token cleared from main process');
            } else {
                console.error('Failed to clear token:', result.error);
            }
        } catch (error) {
            console.error('Failed to clear token:', error);
        }
    }
    
    /**
     * Clear all auth data from main process
     * @returns {Promise<void>}
     */
    static async clearAll() {
        try {
            const result = await window.electronAPI.auth.clearAll();
            if (result.success) {
                console.log('All auth data cleared from main process');
            } else {
                console.error('Failed to clear all auth data:', result.error);
            }
        } catch (error) {
            console.error('Failed to clear all auth data:', error);
        }
    }
    
    /**
     * Validate token with server (via main process)
     * @param {string} token - Token to validate
     * @returns {Promise<boolean>} True if valid
     */
    static async validateTokenWithServer(token) {
        try {
            const result = await window.electronAPI.auth.validateToken(token);
            if (result.success) {
                return result.isValid;
            } else {
                console.error('Failed to validate token with server:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Token validation failed:', error);
            return false;
        }
    }
    
    /**
     * Refresh token (via main process)
     * @returns {Promise<Object>} Refresh result
     */
    static async refreshToken() {
        try {
            const result = await window.electronAPI.auth.refreshToken();
            if (result.success) {
                console.log('Token refreshed successfully');
                return { success: true, token: result.token };
            } else {
                console.log('Token refresh failed:', result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Ensure we have a valid token (via main process)
     * @returns {Promise<Object>} Token validation result
     */
    static async ensureValidToken() {
        try {
            const token = await this.getValidToken();
            if (token) {
                return { valid: true, token: token, refreshed: false };
            } else {
                return { valid: false, error: 'No valid token available' };
            }
        } catch (error) {
            console.error('Failed to ensure valid token:', error);
            return { valid: false, error: error.message };
        }
    }
    
    /**
     * Get comprehensive token information from main process
     * @returns {Promise<Object>} Token information
     */
    static async getTokenInfo() {
        try {
            const result = await window.electronAPI.auth.getTokenInfo();
            if (result.success) {
                return result.tokenInfo;
            } else {
                console.error('Failed to get token info:', result.error);
                return {
                    token: null,
                    email: null,
                    isValid: false,
                    timeRemaining: 0,
                    expiringSoon: true
                };
            }
        } catch (error) {
            console.error('Failed to get token info:', error);
            return {
                token: null,
                email: null,
                isValid: false,
                timeRemaining: 0,
                expiringSoon: true
            };
        }
    }
} 