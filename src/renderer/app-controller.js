/**
 * Application Controller
 * Main controller that orchestrates all modules and manages app state
 */

import { AuthManager } from './auth/auth-manager.js';
import { UploadManager } from './upload/upload-manager.js';
import { UIComponents } from './components/ui-components.js';
import { config } from './config/app-config.js';
import { ScreenManager } from './screens/screen-manager.js';
import { UpdateManager } from './components/update-manager.js';
import { logger } from './logger.js';

export class AppController {
    constructor() {
        this.authManager = new AuthManager();
        this.uploadManager = new UploadManager();
        this.updateManager = null;
        this.currentTab = 'import';
        this.isInitialized = false;
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    async initializeApp() {
        try {
            // Initialize version from main process BEFORE version check
            logger.info('Initializing ZenTransfer app...');
            const result = await window.electronAPI.app.getVersion();
            logger.info('ZenTransfer renderer initialized', { version: result });
            config.setVersion(result);

            // Get the configuration from the main process
            const inheritedConfig = await window.electronAPI.app.getConfig();
            logger.info('AppController: Configuration received from main process', { config: config });
            config.APP_NAME = inheritedConfig.APP_NAME;
            config.CLIENT_ID = inheritedConfig.CLIENT_ID;
            config.SERVER_BASE_URL = inheritedConfig.serverBaseUrl;
            config.IS_DEVELOPMENT = inheritedConfig.isDevelopment;
            
            // Initialize screen manager
            this.screenManager = new ScreenManager(this.authManager, this.uploadManager, this);
            
            // Show loader screen and perform version check
            const shouldProceed = await this.screenManager.showLoaderAndCheckVersion();
            
            if (!shouldProceed) {
                logger.info('App initialization stopped due to version check failure');
                // Exit the app if in Electron environment
                if (window.electronAPI) {
                    try {
                        setTimeout(() => {
                            window.electronAPI.app.quit();
                        }, 1000);
                    } catch (error) {
                        logger.error('Failed to quit app', { error });
                    }
                }
                return;
            }
            
            // Set up authentication state change handler
            logger.info('AppController: Setting up auth state change callback');
            this.authManager.setAuthStateChangeCallback((state) => {
                logger.info('AppController: Auth state change callback triggered with state', { state });
                this.handleAuthStateChange(state);
            });

            // Screen manager handles upload callbacks automatically

            // Initialize update manager
            this.updateManager = new UpdateManager();
            logger.info('Update manager initialized');

            // Initialize UI event listeners
            this.initializeUIEventListeners();

            // Set up global error handling
            this.setupErrorHandling();

            this.isInitialized = true;
            logger.info('App initialization complete');

        } catch (error) {
            logger.error('App initialization failed', { error });
            UIComponents.Notification.show('Failed to initialize app. Please refresh the page.', 'error');
        }
    }

    /**
     * Handle authentication state changes
     * @param {Object} state - Authentication state
     */
    handleAuthStateChange(state) {
        logger.info('AppController: handleAuthStateChange called with state', { state });

        // Show notifications for certain states
        if (state.status === 'otp_required' && state.message) {
            UIComponents.Notification.show(state.message, 'success');
        } else if (state.status === 'authenticated' && state.message) {
            UIComponents.Notification.show(state.message, 'success');
        }

        // Handle upload manager auth state changes
        this.uploadManager.handleAuthStateChange(state);

        // Delegate to screen manager
        logger.info('AppController: Delegating to screen manager...');
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
        
        // UI activity detection for download backoff reset
        this.setupUIActivityDetection();
    }
    
    /**
     * Setup UI activity detection to reset download polling backoff
     */
    setupUIActivityDetection() {
        let lastActivitySignal = 0;
        const throttleDelay = 5000; // Only signal every 5 seconds max
        
        const signalActivity = () => {
            const now = Date.now();
            if (now - lastActivitySignal > throttleDelay) {
                lastActivitySignal = now;
                if (window.electronAPI && window.electronAPI.download) {
                    window.electronAPI.download.signalUIActivity().catch(error => {
                        // Silently ignore errors - this is just an optimization
                        logger.debug('Failed to signal UI activity', { error });
                    });
                }
            }
        };
        
        // Listen for mouse and keyboard activity
        document.addEventListener('mousemove', signalActivity, { passive: true });
        document.addEventListener('click', signalActivity, { passive: true });
        document.addEventListener('keydown', signalActivity, { passive: true });
        document.addEventListener('scroll', signalActivity, { passive: true });
        
        logger.info('UI activity detection setup for download backoff reset');
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
            if (window.electronAPI) {
                // Electron environment
                window.electronAPI.shell.openExternal(url);
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
            logger.error('Global error', { error: event.error });
            logger.error('Error details', {
                message: event.error?.message,
                stack: event.error?.stack,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
            UIComponents.Notification.show('An unexpected error occurred.', 'error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            logger.error('Unhandled promise rejection', { reason: event.reason });
            logger.error('Rejection details', {
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

        logger.info('Main app initialized');
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