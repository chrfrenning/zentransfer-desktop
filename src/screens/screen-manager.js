/**
 * Screen Manager
 * Coordinates all screen modules and provides centralized screen management
 */

import { LoginScreen } from './login-screen.js';
import { ImportScreen } from './import-screen.js';
import { UploadScreen } from './upload-screen.js';
import { DownloadScreen } from './download-screen.js';
import { SettingsScreen } from './settings-screen.js';
import { LoaderScreen } from './loader-screen.js';

export class ScreenManager {
    constructor(authManager, uploadManager, appController = null) {
        this.authManager = authManager;
        this.uploadManager = uploadManager;
        this.appController = appController;
        this.currentScreen = null;
        
        // Initialize all screens
        this.screens = {
            loader: new LoaderScreen(),
            login: new LoginScreen(authManager),
            import: new ImportScreen(uploadManager),
            upload: new UploadScreen(uploadManager),
            download: new DownloadScreen(),
            settings: new SettingsScreen(authManager, () => this.showLoginScreen())
        };

        this.setupScreenCallbacks();
    }

    /**
     * Show loader screen and perform version check
     * @returns {Promise<boolean>} True if app should proceed
     */
    async showLoaderAndCheckVersion() {
        return new Promise((resolve) => {
            // Set up version check callback
            this.screens.loader.setOnVersionCheckComplete((shouldProceed) => {
                if (shouldProceed) {
                    this.screens.loader.hide();
                }
                resolve(shouldProceed);
            });

            // Show loader and start version check
            this.screens.loader.show();
            this.screens.loader.performVersionCheck();
        });
    }

    /**
     * Setup callbacks between screens and managers
     */
    setupScreenCallbacks() {
        // Upload manager callbacks
        this.uploadManager.setProgressCallback((fileItem) => {
            this.screens.upload.updateFileProgress(fileItem);
        });

        this.uploadManager.setQueueCallback((stats) => {
            this.screens.upload.updateQueueDisplay(stats);
        });

        // Settings screen callback for cloud service changes
        this.screens.settings.setOnSettingsChangeCallback(() => {
            // Refresh import screen service availability when cloud settings change
            this.screens.import.refreshServiceAvailability();
        });
    }

    /**
     * Show a specific screen
     * @param {string} screenName - Name of screen to show
     */
    async showScreen(screenName) {
        // Hide all screens except login (which has its own visibility logic)
        Object.entries(this.screens).forEach(([name, screen]) => {
            if (name !== 'login' && name !== screenName) {
                screen.hide();
            }
        });

        // Show the requested screen
        if (this.screens[screenName]) {
            await this.screens[screenName].show();
            this.currentScreen = screenName;
            console.log(`Switched to ${screenName} screen`);
        } else {
            console.warn(`Screen "${screenName}" not found`);
        }
    }

    /**
     * Hide all screens
     */
    hideAllScreens() {
        Object.values(this.screens).forEach(screen => {
            screen.hide();
        });
        this.currentScreen = null;
    }

    /**
     * Get current active screen
     * @returns {string|null} Current screen name
     */
    getCurrentScreen() {
        return this.currentScreen;
    }

    /**
     * Get screen instance by name
     * @param {string} screenName - Screen name
     * @returns {Object|null} Screen instance
     */
    getScreen(screenName) {
        return this.screens[screenName] || null;
    }

    /**
     * Check if a screen is currently visible
     * @param {string} screenName - Screen name
     * @returns {boolean} True if screen is visible
     */
    isScreenVisible(screenName) {
        const screen = this.getScreen(screenName);
        return screen ? screen.isScreenVisible() : false;
    }

    /**
     * Handle authentication state changes
     * @param {Object} state - Authentication state
     */
    handleAuthStateChange(state) {
        console.log('ScreenManager: handleAuthStateChange called with state:', state);
        
        switch (state.status) {
            case 'checking':
                console.log('ScreenManager: Handling checking state');
                this.screens.login.showLoading(state.message);
                break;

            case 'unauthenticated':
                console.log('ScreenManager: Handling unauthenticated state');
                this.screens.login.hideLoading();
                this.showLoginScreen();
                // Refresh import screen service availability when user logs out
                this.screens.import.refreshServiceAvailability();
                break;

            case 'otp_required':
                console.log('ScreenManager: Handling otp_required state');
                this.screens.login.hideLoading();
                this.screens.login.switchToOTPStep(state.email);
                break;

            case 'authenticated':
                console.log('ScreenManager: Handling authenticated state');
                this.screens.login.hideLoading();
                this.hideLoginScreen();
                setTimeout(async () => {
                    await this.showMainApp();
                    if (this.appController && this.appController.initializeMainApp) {
                        this.appController.initializeMainApp();
                    }
                    // Refresh import screen service availability when user logs in
                    this.screens.import.refreshServiceAvailability();
                }, 1500);
                break;

            case 'offline':
                console.log('ScreenManager: Handling offline state');
                this.screens.login.hideLoading();
                this.hideLoginScreen();
                console.log('ScreenManager: About to show main app in offline mode');
                setTimeout(async () => {
                    console.log('ScreenManager: Showing main app after timeout');
                    await this.showMainApp();
                    if (this.appController && this.appController.initializeMainApp) {
                        this.appController.initializeMainApp();
                    }
                    // Update UI to reflect offline mode
                    this.updateOfflineModeUI();
                    // Refresh import screen service availability in offline mode
                    this.screens.import.refreshServiceAvailability();
                }, 1500);
                break;

            default:
                console.warn('ScreenManager: Unknown auth state:', state.status);
        }
    }

    /**
     * Show login screen
     */
    showLoginScreen() {
        console.log('Showing login screen...');
        
        // First hide all main app screens
        this.hideAllScreens();
        
        // Get the DOM elements
        const loginScreen = document.getElementById('loginScreen');
        const mainAppScreen = document.getElementById('mainAppScreen');
        
        // Hide main app screen
        if (mainAppScreen) {
            mainAppScreen.classList.add('hidden');
            console.log('Main app screen hidden');
        }
        
        // Show login screen
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            console.log('Login screen displayed');
        } else {
            console.error('Login screen element not found!');
        }

        // Show the login screen component
        this.screens.login.show();
        console.log('Login screen component shown');
    }

    /**
     * Hide login screen
     */
    hideLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        
        if (loginScreen) {
            loginScreen.style.display = 'none';
        }

        this.screens.login.hide();
    }

    /**
     * Show main app
     */
    async showMainApp() {
        const mainAppScreen = document.getElementById('mainAppScreen');
        
        if (mainAppScreen) {
            mainAppScreen.classList.remove('hidden');
        }

        // Start with import screen
        await this.showScreen('import');
        this.updateTabButtons('import');
    }

    /**
     * Switch between main app tabs
     * @param {string} tabName - Tab name to switch to
     */
    async switchTab(tabName) {
        await this.showScreen(tabName);
        this.updateTabButtons(tabName);
    }

    /**
     * Update tab button states
     * @param {string} activeTab - Currently active tab
     */
    updateTabButtons(activeTab) {
        const tabs = ['import', 'upload', 'download', 'settings'];
        const isOffline = !this.authManager.isLoggedIn();
        
        tabs.forEach(tab => {
            const tabButton = document.getElementById(`${tab}TabBtn`);
            
            if (tabButton) {
                // Disable download tab in offline mode
                if (tab === 'download' && isOffline) {
                    tabButton.disabled = true;
                    tabButton.classList.add('opacity-50', 'cursor-not-allowed');
                    tabButton.classList.remove('hover:text-gray-700', 'hover:bg-gray-50');
                } else {
                    tabButton.disabled = false;
                    tabButton.classList.remove('opacity-50', 'cursor-not-allowed');
                    if (tab !== activeTab) {
                        tabButton.classList.add('hover:text-gray-700', 'hover:bg-gray-50');
                    }
                }
                
                if (tab === activeTab) {
                    tabButton.className = tabButton.className.replace(
                        /text-gray-500 hover:text-gray-700 hover:bg-gray-50/g,
                        'text-primary-600 bg-primary-50'
                    );
                } else {
                    tabButton.className = tabButton.className.replace(
                        /text-primary-600 bg-primary-50/g,
                        'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    );
                }
            }
        });
    }

    /**
     * Update UI for offline mode
     */
    updateOfflineModeUI() {
        // Disable download tab
        const downloadTabBtn = document.getElementById('downloadTabBtn');
        if (downloadTabBtn) {
            downloadTabBtn.disabled = true;
            downloadTabBtn.classList.add('opacity-50', 'cursor-not-allowed');
            downloadTabBtn.classList.remove('hover:text-gray-700', 'hover:bg-gray-50');
            
            // Add click handler to show offline message
            downloadTabBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof UIComponents !== 'undefined' && UIComponents.Notification) {
                    UIComponents.Notification.show('Download feature requires login. Please log in to access downloads.', 'warning');
                }
            });
        }
        
        // Update tab buttons to reflect offline state
        this.updateTabButtons(this.currentScreen || 'import');
    }

    /**
     * Get statistics from all screens
     * @returns {Object} Combined screen statistics
     */
    getAllScreenStats() {
        return {
            login: {
                isVisible: this.isScreenVisible('login'),
                formData: this.screens.login.getFormData()
            },
            import: {
                isVisible: this.isScreenVisible('import'),
                stats: this.screens.import.getImportStats()
            },
            upload: {
                isVisible: this.isScreenVisible('upload'),
                queueStats: this.uploadManager.getQueueStats()
            },
            download: {
                isVisible: this.isScreenVisible('download'),
                stats: this.screens.download.getDownloadStats()
            },
            settings: {
                isVisible: this.isScreenVisible('settings'),
                stats: this.screens.settings.getAppStats()
            },
            current: this.currentScreen
        };
    }

    /**
     * Cleanup all screens
     */
    destroy() {
        Object.values(this.screens).forEach(screen => {
            if (screen.destroy) {
                screen.destroy();
            }
        });
        
        this.screens = {};
        this.currentScreen = null;
    }
} 