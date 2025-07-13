/**
 * Token Manager
 * Handles JWT token storage, validation, and refresh
 */

import { JWTUtils } from './jwt-utils.js';
import { LoginAPI } from './login-api.js';

export class TokenManager {
    static TOKEN_KEY = 'zentransfer_auth_token';
    static TOKEN_METADATA_KEY = 'zentransfer_token_metadata';
    
    static async saveToken(token, userEmail = null) {
        try {
            // Save token to config system
            await window.electronAPI.config.set('authToken', token);
            
            // Save email if provided
            if (userEmail) {
                await window.electronAPI.config.set('email', userEmail);
            }
            
            console.log('Token saved successfully to config');
            return true;
        } catch (error) {
            console.error('Failed to save token:', error);
            return false;
        }
    }
    
    static async getToken() {
        try {
            return await window.electronAPI.config.get('authToken');
        } catch (error) {
            console.error('Failed to get token from config:', error);
            return null;
        }
    }
    
    static async getEmail() {
        try {
            return await window.electronAPI.config.get('email');
        } catch (error) {
            console.error('Failed to get email from config:', error);
            return null;
        }
    }
    
    static async isTokenValid() {
        try {
            const token = await this.getToken();
            if (!token) {
                return false;
            }
            
            // Check if token is expired
            if (JWTUtils.isTokenExpired(token)) {
                console.log('Token is expired');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Failed to validate token:', error);
            return false;
        }
    }

    static async isTokenExpiringSoon(minutesThreshold = 5) {
        try {
            const token = await this.getToken();
            if (!token) {
                return true;
            }
            
            return JWTUtils.isTokenExpiringSoon(token, minutesThreshold);
        } catch (error) {
            console.error('Failed to check token expiration:', error);
            return true;
        }
    }

    static async getTokenTimeRemaining() {
        try {
            const token = await this.getToken();
            if (!token) {
                return 0;
            }
            
            return JWTUtils.getTimeUntilExpiry(token);
        } catch (error) {
            console.error('Failed to get token time remaining:', error);
            return 0;
        }
    }
    
    static async clearToken() {
        try {
            await window.electronAPI.config.set('authToken', '');
            console.log('Token cleared from config (email preserved)');
        } catch (error) {
            console.error('Failed to clear token from config:', error);
        }
    }
    
    static async clearAll() {
        try {
            await window.electronAPI.config.set('authToken', '');
            await window.electronAPI.config.set('email', '');
            console.log('Token and email cleared from config');
        } catch (error) {
            console.error('Failed to clear token and email from config:', error);
        }
    }
    
    static async validateTokenWithServer(token) {
        try {
            console.log('Validating token with server...');
            const isValid = await LoginAPI.verify(token);
            
            if (isValid) {
                console.log('Token is valid on server');
                return true;
            } else {
                console.log('Token is invalid on server, attempting refresh...');
                
                // Try to refresh the token
                const refreshResult = await this.refreshToken(token);
                if (refreshResult.success) {
                    console.log('Token refreshed successfully');
                    return true;
                } else {
                    console.log('Token refresh failed');
                    return false;
                }
            }
        } catch (error) {
            console.error('Token validation failed:', error);
            return false;
        }
    }
    
    static async refreshToken(currentToken = null) {
        try {
            const token = currentToken || await this.getToken();
            if (!token) {
                return { success: false, error: 'No token to refresh' };
            }
            
            console.log('Attempting to refresh token...');
            const response = await LoginAPI.refresh(token);
            
            if (response.result === 'ok' && response.token) {
                // Get current email to preserve it
                const currentEmail = await this.getEmail();
                
                // Save new token
                await this.saveToken(response.token, currentEmail);
                
                console.log('Token refreshed successfully');
                return { success: true, token: response.token };
            } else {
                console.log('Token refresh failed:', response.message);
                return { success: false, error: response.message || 'Refresh failed' };
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            return { success: false, error: error.message };
        }
    }
    
    static async ensureValidToken() {
        try {
            const isValid = await this.isTokenValid();
            if (!isValid) {
                return { valid: false, error: 'No valid token' };
            }
            
            const token = await this.getToken();
            
            // If token is expiring soon, try to refresh it
            const expiringSoon = await this.isTokenExpiringSoon(10); // 10 minutes threshold
            if (expiringSoon) {
                console.log('Token expiring soon, refreshing...');
                const refreshResult = await this.refreshToken();
                
                if (refreshResult.success) {
                    return { valid: true, token: refreshResult.token, refreshed: true };
                } else {
                    return { valid: false, error: 'Token refresh failed' };
                }
            }
            
            return { valid: true, token: token, refreshed: false };
        } catch (error) {
            console.error('Failed to ensure valid token:', error);
            return { valid: false, error: error.message };
        }
    }
} 