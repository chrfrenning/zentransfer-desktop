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
        this.currentEmail = null; // Store current email from input field
        this.deviceId = null; // Will be loaded asynchronously
        this.deviceIdPromise = null; // Promise for device ID loading
        this.isCheckingToken = false;
        this.tokenRefreshTimer = null;
        this.onAuthStateChange = null;
        
        // Don't check token in constructor - wait for callback to be set
    }

    /**
     * Set the callback for authentication state changes
     * @param {Function} callback - Callback function to handle state changes
     */
    setAuthStateChangeCallback(callback) {
        this.onAuthStateChange = callback;
        
        // Auto-check token when callback is set
        this.checkExistingToken();
    }

    /**
     * Get device ID with caching
     * @returns {Promise<string>} Device ID
     */
    async getDeviceId() {
        if (this.deviceId) {
            return this.deviceId;
        }
        
        if (this.deviceIdPromise) {
            return this.deviceIdPromise;
        }
        
        this.deviceIdPromise = DeviceManager.getDeviceId();
        this.deviceId = await this.deviceIdPromise;
        
        return this.deviceId;
    }

    /**
     * Notify authentication state change
     * @param {Object} state - Authentication state object
     */
    notifyAuthStateChange(state) {
        if (this.onAuthStateChange) {
            this.onAuthStateChange(state);
        }
    }

    /**
     * Check for existing valid token and authenticate automatically
     */
    async checkExistingToken() {
        this.isCheckingToken = true;
        
        // Notify loading state
        this.notifyAuthStateChange({ 
            status: 'checking', 
            message: 'Checking authentication...' 
        });
        
        try {
            // Check if we have a token locally
            const hasToken = await TokenManager.getToken();
            console.log('hasToken', hasToken);
            
            if (hasToken && await TokenManager.isTokenValid()) {
                const token = await TokenManager.getToken();
                const email = await TokenManager.getEmail();
                
                console.log('Found valid token, attempting server validation...');
                
                // Validate token with server and handle refresh if needed
                const isServerValid = await TokenManager.validateTokenWithServer(token);
                
                if (isServerValid) {
                    console.log('Token validated with server, proceeding to main app');
                    // Get updated token in case it was refreshed
                    const updatedToken = await TokenManager.getToken();
                    await this.proceedToMainApp(updatedToken, email);
                    return;
                } else {
                    console.log('Token validation/refresh failed, clearing token but keeping email');
                    await TokenManager.clearToken(); // Only clear token, keep email
                    // Token exists but can't be refreshed - show login screen
                    this.isCheckingToken = false;
                    this.notifyAuthStateChange({ 
                        status: 'unauthenticated',
                        message: 'Your session has expired. Please log in again.'
                    });
                    return;
                }
            } else if (hasToken) {
                console.log('Found expired token, clearing token but keeping email');
                await TokenManager.clearToken(); // Only clear token, keep email
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
            // If there was a token but validation failed, clear only token
            const hadToken = await TokenManager.getToken();
            await TokenManager.clearToken(); // Only clear token, keep email
            
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
    
    async proceedToMainApp(token, email) {
        console.log('Proceeding to main app with token:', token);
        console.log('User email:', email);
        
        // Notify successful authentication
        this.notifyAuthStateChange({ 
            status: 'authenticated', 
            user: { email: email },
            message: `Welcome back${email ? ', ' + email : ''}!`
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
            // Store the email from input field
            this.currentEmail = email;
            
            const deviceId = await this.getDeviceId();
            const response = await LoginAPI.initialize(email, deviceId);
            
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
                await this.handleSuccessfulLogin(response.token);
                return { success: true };
            } else {
                throw new Error(response.message || 'Invalid OTP code');
            }
        } catch (error) {
            console.error('Login finalization failed:', error);
            throw error;
        }
    }
    
    async handleSuccessfulLogin(token) {
        // Use email from input field, not from token
        const userEmail = this.currentEmail || 'Unknown';
        
        // Save token with email from input
        await TokenManager.saveToken(token, userEmail);
        
        // Reset login state
        this.sessionId = null;
        this.isEmailSubmitted = false;
        
        // Proceed to main app
        await this.proceedToMainApp(token, userEmail);
        
        // Clear stored email
        this.currentEmail = null;
    }
    
    resetToEmailStep() {
        this.sessionId = null;
        this.isEmailSubmitted = false;
        this.currentEmail = null;
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
                const token = await TokenManager.getToken();
                if (!token) {
                    console.log('No token found, stopping refresh timer');
                    this.stopTokenRefreshTimer();
                    return;
                }
                
                // Check if token needs refresh (5 minutes before expiry)
                const expiringSoon = await TokenManager.isTokenExpiringSoon(5);
                if (expiringSoon) {
                    console.log('Token expiring soon, attempting background refresh...');
                    const refreshResult = await TokenManager.refreshToken();
                    
                    if (refreshResult.success) {
                        console.log('Token refreshed successfully in background');
                    } else {
                        console.log('Background token refresh failed, user will need to re-login');
                        await this.logout();
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
        this.notifyAuthStateChange({ 
            status: 'offline', 
            message: 'Using offline mode - log in to access all features'
        });
    }
    
    /**
     * Trigger a login flow (used by settings screen)
     */
    triggerLogin() {
        console.log('Triggering login flow...');
        this.notifyAuthStateChange({ 
            status: 'unauthenticated',
            message: 'Please log in to access all features'
        });
    }

    async logout() {
        console.log('Logging out user...');
        
        // Stop token refresh timer
        this.stopTokenRefreshTimer();
        
        // Clear all stored data (both token and email)
        await TokenManager.clearAll();
        
        // Reset state
        this.sessionId = null;
        this.isEmailSubmitted = false;
        this.currentEmail = null;
        
        // Notify logout
        this.notifyAuthStateChange({ 
            status: 'unauthenticated',
            message: 'You have been logged out'
        });
        
        console.log('User logged out successfully');
    }
    
    async isLoggedIn() {
        return await TokenManager.isTokenValid();
    }
    
    async getCurrentUser() {
        if (!await this.isLoggedIn()) {
            return null;
        }
        
        const email = await TokenManager.getEmail();
        return { email: email };
    }
    
    async getToken() {
        return await TokenManager.getToken();
    }
    
    async getTokenInfo() {
        return {
            token: await TokenManager.getToken(),
            email: await TokenManager.getEmail(),
            isValid: await TokenManager.isTokenValid(),
            timeRemaining: await TokenManager.getTokenTimeRemaining()
        };
    }
    
    async clearAllData() {
        await TokenManager.clearAll();
        await DeviceManager.clearDeviceId();
        await this.logout();
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
} 