/**
 * Application Controller
 * Main controller that orchestrates all modules and manages app state
 */
window.logger.debug("In AppController.js")

import { AuthenticationBridge } from './bridges/AuthenticationBridge.js';
window.logger.debug('AuthenticationBridge loaded');

import { ScreenManager } from './screens/ScreenManager.js';
window.logger.debug('ScreenManager loaded');

class AppController {
    constructor() {
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
            window.logger.info('Initializing ZenTransfer Renderer...');
            const result = await window.electronAPI.app.getVersion();
            window.logger.info(`We're good to go, version: ${result}, type of result ${typeof result}`);

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



            // Initialize UI event listeners
            this.initializeUIEventListeners();

            // Set up global error handling
            this.setupErrorHandling();

            this.isInitialized = true;
            logger.info('App initialization complete');

        } catch (error) {
            logger.error('App initialization failed', { error });
            console.error('Failed to initialize app. Please refresh the page.');
        }
    }

    /**
     * Handle authentication state changes
     * @param {Object} state - Authentication state
     */
    handleAuthStateChange(state) {
        logger.info('AppController: handleAuthStateChange called with state', { state });

        // Log messages for certain states
        if (state.status === 'otp_required' && state.message) {
            window.logger.info(state.message);
        } else if (state.status === 'authenticated' && state.message) {
            window.logger.info(state.message);
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
            console.error('An unexpected error occurred.');
        });

        window.addEventListener('unhandledrejection', (event) => {
            logger.error('Unhandled promise rejection', { reason: event.reason });
            logger.error('Rejection details', {
                reason: event.reason,
                promise: event.promise,
                stack: event.reason?.stack
            });
            console.error('An unexpected error occurred.');
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