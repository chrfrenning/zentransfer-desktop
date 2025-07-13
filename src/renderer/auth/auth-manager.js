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
        
        // Don't check token in constructor - wait for callback to be set
    }

    /**
     * Set callback for authentication state changes and start auth check
     * @param {Function} callback - Called when auth state changes
     */
    setAuthStateChangeCallback(callback) {
        this.onAuthStateChange = callback;
        // Now that callback is set, start the authentication check
        this.checkExistingToken();
    }

    /**
     * Notify listeners of auth state change
     * @param {Object} state - Current auth state
     */
    notifyAuthStateChange(state) {
        console.log('AuthManager: notifyAuthStateChange called with state:', state);
        console.log('AuthManager: onAuthStateChange callback exists:', !!this.onAuthStateChange);
        if (this.onAuthStateChange) {
            console.log('AuthManager: Calling auth state change callback');
            this.onAuthStateChange(state);
        } else {
            console.log('AuthManager: No callback set, state change ignored');
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
            // Check if we have a token locally
            const hasToken = TokenManager.getToken();
            console.log('hasToken', hasToken);
            
            if (hasToken && TokenManager.isTokenValid()) {
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
                    console.log('Token validation/refresh failed, showing login screen');
                    TokenManager.clearToken();
                    // Token exists but can't be refreshed - show login screen
                    this.isCheckingToken = false;
                    this.notifyAuthStateChange({ 
                        status: 'unauthenticated',
                        message: 'Your session has expired. Please log in again.'
                    });
                    return;
                }
            } else if (hasToken && !TokenManager.isTokenValid()) {
                console.log('Found expired token, showing login screen');
                TokenManager.clearToken();
                // Token exists but is expired - show login screen
                this.isCheckingToken = false;
                this.notifyAuthStateChange({ 
                    status: 'unauthenticated',
                    message: 'Your session has expired. Please log in again.'
                });
                return;
            } else {
                console.log('No token found, proceeding to offline mode');
            }
        } catch (error) {
            console.error('Token validation error:', error);
            // If there was a token but validation failed, show login screen
            const hadToken = TokenManager.getToken();
            TokenManager.clearToken();
            
            if (hadToken) {
                this.isCheckingToken = false;
                this.notifyAuthStateChange({ 
                    status: 'unauthenticated',
                    message: 'Authentication failed. Please log in again.'
                });
                return;
            }
        }
        
        // No token found or first time startup - proceed to offline mode
        this.isCheckingToken = false;
        console.log('Starting in offline mode...');
        this.notifyAuthStateChange({ 
            status: 'offline', 
            message: 'Using offline mode - log in to access all features'
        });
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

    /**
     * Trigger login flow from settings screen
     */
    triggerLogin() {
        console.log('Triggering login flow from settings...');
        
        // Clear any existing session data
        this.sessionId = null;
        this.isEmailSubmitted = false;
        
        // Notify that we want to show login screen
        this.notifyAuthStateChange({ 
            status: 'unauthenticated',
            message: 'Please log in to access all features'
        });
        
        console.log('Login flow triggered');
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