/**
 * Token Manager
 * Handles JWT token storage, validation, and refresh
 */

import { JWTUtils } from './jwt-utils.js';
import { LoginAPI } from './login-api.js';

export class TokenManager {
    static TOKEN_KEY = 'zentransfer_auth_token';
    static TOKEN_METADATA_KEY = 'zentransfer_token_metadata';
    
    static saveToken(token, userEmail = null) {
        try {
            localStorage.setItem(this.TOKEN_KEY, token);
            
            // Save metadata
            const metadata = {
                email: userEmail,
                savedAt: Date.now(),
                deviceId: localStorage.getItem('zentransfer_device_id')
            };
            
            localStorage.setItem(this.TOKEN_METADATA_KEY, JSON.stringify(metadata));
            
            console.log('Token saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save token:', error);
            return false;
        }
    }
    
    static getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }
    
    static getTokenMetadata() {
        try {
            const metadata = localStorage.getItem(this.TOKEN_METADATA_KEY);
            return metadata ? JSON.parse(metadata) : null;
        } catch (error) {
            console.error('Failed to parse token metadata:', error);
            return null;
        }
    }
    
    static isTokenValid() {
        const token = this.getToken();
        if (!token) {
            return false;
        }
        
        // Check if token is expired
        if (JWTUtils.isTokenExpired(token)) {
            console.log('Token is expired');
            return false;
        }
        
        return true;
    }
    
    static isTokenExpiringSoon(minutesThreshold = 5) {
        const token = this.getToken();
        if (!token) {
            return true;
        }
        
        return JWTUtils.isTokenExpiringSoon(token, minutesThreshold);
    }
    
    static getTokenTimeRemaining() {
        const token = this.getToken();
        if (!token) {
            return 0;
        }
        
        return JWTUtils.getTimeUntilExpiry(token);
    }
    
    static clearToken() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.TOKEN_METADATA_KEY);
        console.log('Token cleared');
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
            const token = currentToken || this.getToken();
            if (!token) {
                return { success: false, error: 'No token to refresh' };
            }
            
            console.log('Attempting to refresh token...');
            const response = await LoginAPI.refresh(token);
            
            if (response.result === 'ok' && response.token) {
                // Get current metadata
                const metadata = this.getTokenMetadata();
                const userEmail = metadata?.email;
                
                // Save new token
                this.saveToken(response.token, userEmail);
                
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
        if (!this.isTokenValid()) {
            return { valid: false, error: 'No valid token' };
        }
        
        const token = this.getToken();
        
        // If token is expiring soon, try to refresh it
        if (this.isTokenExpiringSoon(10)) { // 10 minutes threshold
            console.log('Token expiring soon, refreshing...');
            const refreshResult = await this.refreshToken();
            
            if (refreshResult.success) {
                return { valid: true, token: refreshResult.token, refreshed: true };
            } else {
                return { valid: false, error: 'Token refresh failed' };
            }
        }
        
        return { valid: true, token: token, refreshed: false };
    }
} 