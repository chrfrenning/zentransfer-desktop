/**
 * Authentication Manager
 * Handles login, token management, and user session
 */

import { LoginAPI } from './login-api.js';
import { TokenManager } from './token-manager.js';
import { DeviceManager } from './device-manager.js';
import { JWTUtils } from './jwt-utils.js';

export class AuthManager {
    constructor() {
        this.sessionId = null;
        this.isEmailSubmitted = false;
        this.deviceId = DeviceManager.getDeviceId();
        this.isCheckingToken = false;
        this.tokenRefreshTimer = null;
        this.onAuthStateChange = null;
        
        // Check for existing valid token before showing login form
        this.checkExistingToken();
    }

    /**
     * Set callback for authentication state changes
     * @param {Function} callback - Called when auth state changes
     */
    setAuthStateChangeCallback(callback) {
        this.onAuthStateChange = callback;
    }

    /**
     * Notify listeners of auth state change
     * @param {Object} state - Current auth state
     */
    notifyAuthStateChange(state) {
        if (this.onAuthStateChange) {
            this.onAuthStateChange(state);
        }
    }

    async checkExistingToken() {
        this.isCheckingToken = true;
        
        // Notify loading state
        this.notifyAuthStateChange({ 
            status: 'checking', 
            message: 'Checking authentication...' 
        });
        
        try {
            // Check if we have a valid token locally
            if (TokenManager.isTokenValid()) {
                const token = TokenManager.getToken();
                const metadata = TokenManager.getTokenMetadata();
                
                console.log('Found valid token, attempting server validation...');
                
                // Validate token with server and handle refresh if needed
                const isServerValid = await TokenManager.validateTokenWithServer(token);
                
                if (isServerValid) {
                    console.log('Token validated with server, proceeding to main app');
                    // Get updated metadata in case token was refreshed
                    const updatedMetadata = TokenManager.getTokenMetadata();
                    this.proceedToMainApp(TokenManager.getToken(), updatedMetadata);
                    return;
                } else {
                    console.log('Token validation/refresh failed, clearing local token');
                    TokenManager.clearToken();
                }
            } else {
                console.log('No valid local token found');
            }
        } catch (error) {
            console.error('Token validation error:', error);
            TokenManager.clearToken();
        }
        
        // No valid token found, show login form
        this.isCheckingToken = false;
        this.notifyAuthStateChange({ status: 'unauthenticated' });
    }
    
    proceedToMainApp(token, metadata) {
        console.log('Proceeding to main app with token:', token);
        console.log('User email:', metadata?.email);
        
        // Notify successful authentication
        this.notifyAuthStateChange({ 
            status: 'authenticated', 
            user: metadata,
            message: `Welcome back${metadata?.email ? ', ' + metadata.email : ''}!`
        });
        
        // Start periodic token refresh check
        this.startTokenRefreshTimer();
    }
    
    async initializeLogin(email) {
        if (!email) {
            throw new Error('Please enter your email address');
        }
        
        if (!this.isValidEmail(email)) {
            throw new Error('Please enter a valid email address');
        }
        
        try {
            const response = await LoginAPI.initialize(email, this.deviceId);
            
            if (response.result === 'ok') {
                this.sessionId = response.session_id;
                this.isEmailSubmitted = true;
                
                this.notifyAuthStateChange({ 
                    status: 'otp_required',
                    email: email,
                    message: 'OTP sent to your email'
                });
                
                return { success: true, sessionId: this.sessionId };
            } else {
                throw new Error(response.message || 'Failed to send OTP');
            }
        } catch (error) {
            console.error('Login initialization failed:', error);
            throw error;
        }
    }
    
    async finalizeLogin(otp) {
        if (!otp || otp.length !== 6) {
            throw new Error('Please enter a valid 6-digit OTP');
        }
        
        if (!this.sessionId) {
            throw new Error('No active session. Please restart the login process.');
        }
        
        try {
            const response = await LoginAPI.finalize(this.sessionId, otp);
            
            if (response.result === 'ok' && response.token) {
                this.handleSuccessfulLogin(response.token);
                return { success: true };
            } else {
                throw new Error(response.message || 'Invalid OTP code');
            }
        } catch (error) {
            console.error('Login finalization failed:', error);
            throw error;
        }
    }
    
    handleSuccessfulLogin(token) {
        // Decode token to get user info
        const payload = JWTUtils.decodeToken(token);
        const userEmail = payload?.email || 'Unknown';
        
        // Save token with metadata
        TokenManager.saveToken(token, userEmail);
        
        // Reset login state
        this.sessionId = null;
        this.isEmailSubmitted = false;
        
        // Get saved metadata
        const metadata = TokenManager.getTokenMetadata();
        
        // Proceed to main app
        this.proceedToMainApp(token, metadata);
    }
    
    resetToEmailStep() {
        this.sessionId = null;
        this.isEmailSubmitted = false;
        this.notifyAuthStateChange({ status: 'unauthenticated' });
    }
    
    startTokenRefreshTimer() {
        // Clear any existing timer
        if (this.tokenRefreshTimer) {
            clearInterval(this.tokenRefreshTimer);
        }
        
        // Check token every 2 minutes
        this.tokenRefreshTimer = setInterval(async () => {
            try {
                const token = TokenManager.getToken();
                if (!token) {
                    console.log('No token found, stopping refresh timer');
                    this.stopTokenRefreshTimer();
                    return;
                }
                
                // Check if token needs refresh (5 minutes before expiry)
                if (TokenManager.isTokenExpiringSoon(5)) {
                    console.log('Token expiring soon, attempting background refresh...');
                    const refreshResult = await TokenManager.refreshToken();
                    
                    if (refreshResult.success) {
                        console.log('Token refreshed successfully in background');
                    } else {
                        console.log('Background token refresh failed, user will need to re-login');
                        this.logout();
                    }
                }
            } catch (error) {
                console.error('Error during background token refresh:', error);
            }
        }, 2 * 60 * 1000); // Check every 2 minutes
        
        console.log('Token refresh timer started');
    }
    
    stopTokenRefreshTimer() {
        if (this.tokenRefreshTimer) {
            clearInterval(this.tokenRefreshTimer);
            this.tokenRefreshTimer = null;
            console.log('Token refresh timer stopped');
        }
    }
    
    /**
     * Skip login and proceed to offline mode
     */
    skipLogin() {
        console.log('Skipping login, proceeding to offline mode...');
        
        // Clear any existing session data
        this.sessionId = null;
        this.isEmailSubmitted = false;
        TokenManager.clearToken();
        
        // Notify that user is in offline mode
        this.notifyAuthStateChange({ 
            status: 'offline', 
            message: 'Using offline mode - some features are limited'
        });
        
        console.log('Offline mode activated');
    }

    logout() {
        console.log('Logging out user...');
        
        // Stop token refresh timer
        this.stopTokenRefreshTimer();
        
        // Clear all stored data
        TokenManager.clearToken();
        
        // Reset state
        this.sessionId = null;
        this.isEmailSubmitted = false;
        
        // Notify logout
        this.notifyAuthStateChange({ 
            status: 'unauthenticated',
            message: 'You have been logged out'
        });
        
        console.log('User logged out successfully');
    }
    
    isLoggedIn() {
        return TokenManager.isTokenValid();
    }
    
    getCurrentUser() {
        if (!this.isLoggedIn()) {
            return null;
        }
        
        return TokenManager.getTokenMetadata();
    }
    
    getToken() {
        return TokenManager.getToken();
    }
    
    getTokenInfo() {
        return {
            token: TokenManager.getToken(),
            metadata: TokenManager.getTokenMetadata(),
            isValid: TokenManager.isTokenValid(),
            timeRemaining: TokenManager.getTokenTimeRemaining()
        };
    }
    
    clearAllData() {
        TokenManager.clearToken();
        DeviceManager.clearDeviceId();
        this.logout();
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
} 