/**
 * Application Controller
 * Main controller that orchestrates all modules and manages app state
 */

import { AuthManager } from './auth/auth-manager.js';
import { UploadManager } from './upload/upload-manager.js';
import { UIComponents } from './components/ui-components.js';
import { config } from './config/app-config.js';
import { ScreenManager } from './screens/screen-manager.js';

// Import UpdateManager if in Electron environment
let UpdateManager = null;
if (typeof require !== 'undefined') {
    try {
        UpdateManager = require('./components/update-manager.js');
    } catch (error) {
        console.log('UpdateManager not available (not in Electron environment)');
    }
}

export class AppController {
    constructor() {
        this.authManager = new AuthManager();
        this.uploadManager = new UploadManager();
        this.updateManager = null;
        this.currentTab = 'upload';
        this.isInitialized = false;
        
        // Initialize screen manager
        this.screenManager = new ScreenManager(this.authManager, this.uploadManager, this);
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    async initializeApp() {
        try {
            console.log('Initializing ZenTransfer app...');
            
            // Show loader screen and perform version check
            const shouldProceed = await this.screenManager.showLoaderAndCheckVersion();
            
            if (!shouldProceed) {
                console.log('App initialization stopped due to version check');
                // Exit the app if in Electron environment
                if (typeof require !== 'undefined') {
                    try {
                        const { ipcRenderer } = require('electron');
                        setTimeout(() => {
                            ipcRenderer.invoke('app-quit');
                        }, 1000);
                    } catch (error) {
                        console.error('Failed to quit app:', error);
                    }
                }
                return;
            }
            
            // Set up authentication state change handler
            console.log('AppController: Setting up auth state change callback');
            this.authManager.setAuthStateChangeCallback((state) => {
                console.log('AppController: Auth state change callback triggered with state:', state);
                this.handleAuthStateChange(state);
            });

            // Screen manager handles upload callbacks automatically

            // Initialize update manager if available
            if (UpdateManager) {
                this.updateManager = new UpdateManager();
                console.log('Update manager initialized');
            }

            // Initialize UI event listeners
            this.initializeUIEventListeners();

            // Set up global error handling
            this.setupErrorHandling();

            this.isInitialized = true;
            console.log('App initialization complete');

        } catch (error) {
            console.error('App initialization failed:', error);
            UIComponents.Notification.show('Failed to initialize app. Please refresh the page.', 'error');
        }
    }

    /**
     * Handle authentication state changes
     * @param {Object} state - Authentication state
     */
    handleAuthStateChange(state) {
        console.log('AppController: handleAuthStateChange called with state:', state);

        // Show notifications for certain states
        if (state.status === 'otp_required' && state.message) {
            UIComponents.Notification.show(state.message, 'success');
        } else if (state.status === 'authenticated' && state.message) {
            UIComponents.Notification.show(state.message, 'success');
        }

        // Handle upload manager auth state changes
        this.uploadManager.handleAuthStateChange(state);

        // Delegate to screen manager
        console.log('AppController: Delegating to screen manager...');
        this.screenManager.handleAuthStateChange(state);
    }

    /**
     * Initialize UI event listeners
     */
    initializeUIEventListeners() {
        // Tab switching
        this.initializeTabSwitching();

        // External link handling
        this.setupExternalLinks();
    }

    /**
     * Initialize tab switching functionality
     */
    initializeTabSwitching() {
        // Make switchTab function globally available
        window.switchTab = async (tabName) => {
            await this.switchTab(tabName);
        };
    }



    /**
     * Setup external link handling
     */
    setupExternalLinks() {
        // Make openExternal function globally available
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

    /**
     * Setup global error handling
     */
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            console.error('Error details:', {
                message: event.error?.message,
                stack: event.error?.stack,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
            UIComponents.Notification.show('An unexpected error occurred.', 'error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            console.error('Rejection details:', {
                reason: event.reason,
                promise: event.promise,
                stack: event.reason?.stack
            });
            UIComponents.Notification.show('An unexpected error occurred.', 'error');
        });
    }



    /**
     * Initialize main app features after authentication
     */
    initializeMainApp() {
        // Make logout function globally available
        window.ZenTransfer = {
            logout: () => this.authManager.logout(),
            isLoggedIn: () => this.authManager.isLoggedIn(),
            getCurrentUser: () => this.authManager.getCurrentUser(),
            getToken: () => this.authManager.getToken(),
            getTokenInfo: () => this.authManager.getTokenInfo(),
            clearAllData: () => this.authManager.clearAllData()
        };

        console.log('Main app initialized');
    }



    /**
     * Switch between app tabs
     * @param {string} tabName - Tab name to switch to
     */
    async switchTab(tabName) {
        await this.screenManager.switchTab(tabName);
        this.currentTab = tabName;
    }


}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.appController = new AppController();
}); 