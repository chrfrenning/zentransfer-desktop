/**
 * Authentication Manager
 * Handles login, token management, and user session
 */

export class AuthenticationBridge {
    constructor() {
    }
    
    async isLoggedIn() {
        return await window.electronAPI.auth.hasValidToken();
    }
    
    async getCurrentUser() {
        if (!await this.isLoggedIn()) {
            return null;
        }
        
        const email = await window.electronAPI.auth.getEmail();
        return { email: email };
    }

    async initializeLogin(email) {
        if (!email || email === '') {
            window.logger.error('No email address provided');
            throw new Error('Please enter your email address');
        }
        
        if (!this.isValidEmail(email)) {
            window.logger.error('Invalid email address');
            throw new Error('Please enter a valid email address');
        }
        
        window.logger.info('Initializing login...');
        return await window.electronAPI.auth.initializeLogin(email);
    }
    
    async finalizeLogin(otp) {
        if (!otp || otp.length !== 6) {
            window.logger.error('Invalid OTP code');
            throw new Error('Please enter a valid 6-digit OTP');
        }

        window.logger.info('Finalizing login...');
        return await window.electronAPI.auth.finalizeLogin(otp);
    }

    async logout() {
        window.logger.info('Logging out user...');
        result = await window.electronAPI.auth.logout();
        window.logger.info('User logged out successfully');
        return result;
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}