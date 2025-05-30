/**
 * Login Screen
 * Handles the login UI and user interactions
 */

import { UIComponents } from '../components/ui-components.js';
import { config } from '../config/app-config.js';

export class LoginScreen {
    constructor(authManager) {
        this.authManager = authManager;
        this.isVisible = false;
        this.elements = {};
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeVersion();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            loginScreen: document.getElementById('loginScreen'),
            loginForm: document.getElementById('loginForm'),
            emailInput: document.getElementById('email'),
            otpInput: document.getElementById('otp'),
            otpSection: document.getElementById('otpSection'),
            submitButton: document.querySelector('#loginForm button[type="submit"]'),
            versionElement: document.getElementById('appVersion')
        };
    }

    /**
     * Initialize version display
     */
    initializeVersion() {
        if (this.elements.versionElement && config.APP_VERSION) {
            this.elements.versionElement.textContent = `v${config.APP_VERSION}`;
        }
    }

    /**
     * Setup event listeners for login screen
     */
    setupEventListeners() {
        // Login form submission
        if (this.elements.loginForm) {
            this.elements.loginForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Email input changes
        if (this.elements.emailInput) {
            this.elements.emailInput.addEventListener('input', () => {
                if (this.authManager.isEmailSubmitted) {
                    this.authManager.resetToEmailStep();
                } else {
                    this.updateButtonState();
                }
            });
        }

        // OTP input handling
        if (this.elements.otpInput) {
            this.elements.otpInput.addEventListener('input', (e) => {
                // Only allow numbers
                e.target.value = e.target.value.replace(/\D/g, '');
                
                // Update button state
                this.updateButtonState();
                
                // Auto-submit when 6 digits are entered
                if (e.target.value.length === 6 && this.authManager.isEmailSubmitted) {
                    setTimeout(() => {
                        this.finalizeLogin(e.target.value);
                    }, 100);
                }
            });
        }

        // Setup external link handlers
        this.setupExternalLinks();
    }

    /**
     * Setup external link handling
     */
    setupExternalLinks() {
        // Make openExternal function globally available if not already set
        if (!window.openExternal) {
            window.openExternal = (url) => {
                if (typeof require !== 'undefined') {
                    // Electron environment
                    const { shell } = require('electron');
                    shell.openExternal(url);
                } else {
                    // Web environment
                    window.open(url, '_blank');
                }
            };
        }
    }

    /**
     * Show the login screen
     */
    show() {
        if (this.elements.loginScreen) {
            this.elements.loginScreen.style.display = 'flex';
            this.isVisible = true;
            this.resetForm();
            
            // Ensure button state is updated after showing
            setTimeout(() => {
                this.updateButtonState();
            }, 50);
        }
    }

    /**
     * Hide the login screen
     */
    hide() {
        if (this.elements.loginScreen) {
            this.elements.loginScreen.style.display = 'none';
            this.isVisible = false;
        }
    }

    /**
     * Handle form submission
     * @param {Event} e - Form submit event
     */
    async handleSubmit(e) {
        e.preventDefault();
        
        const email = this.elements.emailInput?.value.trim() || '';
        const otp = this.elements.otpInput?.value.trim() || '';
        
        if (!this.authManager.isEmailSubmitted) {
            await this.initializeLogin(email);
        } else {
            await this.finalizeLogin(otp);
        }
    }

    /**
     * Initialize login with email
     * @param {string} email - User email
     */
    async initializeLogin(email) {
        this.setLoading(true, 'Sending OTP...');
        
        try {
            await this.authManager.initializeLogin(email);
            // Auth manager will handle state change and call switchToOTPStep
        } catch (error) {
            // Reset the authentication state on error to ensure UI is consistent
            this.authManager.resetToEmailStep();
            this.setLoading(false);
            UIComponents.Notification.show(error.message, 'error');
        }
    }

    /**
     * Finalize login with OTP
     * @param {string} otp - OTP code
     */
    async finalizeLogin(otp) {
        this.setLoading(true, 'Verifying OTP...');
        
        try {
            await this.authManager.finalizeLogin(otp);
            // Auth manager will handle state change and proceed to main app
        } catch (error) {
            this.setLoading(false);
            UIComponents.Notification.show(error.message, 'error');
        }
    }

    /**
     * Switch to OTP input step
     * @param {string} email - User email
     */
    switchToOTPStep(email) {
        if (this.elements.otpSection && this.elements.otpInput && this.elements.submitButton) {
            this.elements.otpSection.classList.remove('hidden');
            this.elements.otpInput.disabled = false;
            this.elements.otpInput.focus();
            this.elements.submitButton.textContent = 'Verify OTP';
            this.elements.submitButton.disabled = false;
            
            this.addChangeEmailLink();
        }
    }

    /**
     * Add change email link
     */
    addChangeEmailLink() {
        const existingLink = document.getElementById('changeEmailLink');
        if (existingLink) return;

        if (this.elements.otpSection) {
            const link = document.createElement('p');
            link.id = 'changeEmailLink';
            link.className = 'text-center text-sm text-gray-600 mt-2';
            link.innerHTML = `
                <a href="#" onclick="window.appController.authManager.resetToEmailStep()" class="text-primary-600 hover:text-primary-700 font-medium">
                    Change email address
                </a>
            `;
            this.elements.otpSection.appendChild(link);
        }
    }

    /**
     * Reset form to initial state
     */
    resetForm() {
        const changeEmailLink = document.getElementById('changeEmailLink');
        
        if (this.elements.emailInput) {
            this.elements.emailInput.value = '';
            this.elements.emailInput.disabled = false;
        }
        if (this.elements.otpInput) {
            this.elements.otpInput.value = '';
            this.elements.otpInput.disabled = true;
        }
        if (this.elements.otpSection) this.elements.otpSection.classList.add('hidden');
        if (this.elements.submitButton) {
            this.elements.submitButton.textContent = 'Login';
            this.elements.submitButton.disabled = true;
        }
        if (changeEmailLink) changeEmailLink.remove();
        
        this.updateButtonState();
    }

    /**
     * Set loading state
     * @param {boolean} isLoading - Loading state
     * @param {string} message - Loading message
     */
    setLoading(isLoading, message = '') {
        if (this.elements.submitButton) {
            this.elements.submitButton.disabled = isLoading;
            this.elements.submitButton.innerHTML = isLoading ? `
                <div class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    ${message}
                </div>
            ` : (this.authManager.isEmailSubmitted ? 'Verify OTP' : 'Login');
        }
        
        if (this.elements.emailInput) this.elements.emailInput.disabled = isLoading;
        if (this.elements.otpInput) this.elements.otpInput.disabled = isLoading || !this.authManager.isEmailSubmitted;
    }

    /**
     * Update button state based on input validity
     */
    updateButtonState() {
        if (!this.elements.submitButton) return;
        
        let isValid = false;
        
        if (!this.authManager.isEmailSubmitted) {
            // Email step - check for valid email format
            const email = this.elements.emailInput ? this.elements.emailInput.value.trim() : '';
            isValid = email.length > 0 && this.isValidEmail(email);
        } else {
            // OTP step
            isValid = this.elements.otpInput && this.elements.otpInput.value.trim().length === 6;
        }
        
        this.elements.submitButton.disabled = !isValid;
    }

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    showLoading(message) {
        UIComponents.Loading.show(message);
        
        if (this.elements.loginForm) {
            this.elements.loginForm.style.display = 'none';
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        UIComponents.Loading.hide();
        
        if (this.elements.loginForm) {
            this.elements.loginForm.style.display = 'block';
        }
    }

    /**
     * Check if screen is currently visible
     * @returns {boolean} True if visible
     */
    isScreenVisible() {
        return this.isVisible;
    }

    /**
     * Get current form data
     * @returns {Object} Form data
     */
    getFormData() {
        return {
            email: this.elements.emailInput?.value.trim() || '',
            otp: this.elements.otpInput?.value.trim() || '',
            isEmailSubmitted: this.authManager.isEmailSubmitted
        };
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Focus on appropriate input field
     */
    focusInput() {
        if (this.authManager.isEmailSubmitted && this.elements.otpInput && !this.elements.otpInput.disabled) {
            this.elements.otpInput.focus();
        } else if (this.elements.emailInput) {
            this.elements.emailInput.focus();
        }
    }
} 