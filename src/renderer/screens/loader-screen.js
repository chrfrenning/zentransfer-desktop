/**
 * Loader Screen
 * Shows the ZenTransfer logo and performs version checking
 */

import { config } from '../config/app-config.js';
import { UIComponents } from '../components/ui-components.js';

export class LoaderScreen {
    constructor() {
        this.isVisible = false;
        this.elements = {};
        this.onVersionCheckComplete = null;
        this.startTime = null;
        this.minDisplayTime = 3000; // Minimum 3 seconds
        
        this.initializeElements();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            loaderScreen: document.getElementById('loaderScreen')
        };

        // Create the loader screen if it doesn't exist
        if (!this.elements.loaderScreen) {
            this.createLoaderScreen();
        }
    }

    /**
     * Create the loader screen HTML
     */
    createLoaderScreen() {
        const loaderScreen = document.createElement('div');
        loaderScreen.id = 'loaderScreen';
        loaderScreen.className = 'fixed inset-0 flex flex-col items-center justify-center z-50';
        loaderScreen.style.backgroundColor = '#e277cd';
        
        loaderScreen.innerHTML = `
            <div class="text-center">
                <!-- Logo Container -->
                <div class="mb-8">
                    <div class="w-24 h-24 mx-auto flex items-center justify-center">
                        <!-- ZenTransfer Square Logo -->
                        <img src="logo_sq.png" alt="ZenTransfer Logo" class="w-16 h-16 border border-gray-300">
                    </div>
                </div>

                <!-- App Name -->
                <h1 class="text-4xl font-bold text-white mb-2">ZenTransfer</h1>
                <p class="text-purple-200 text-lg mb-8">For Professional Photographers</p>

                <!-- Loading Indicator -->
                <div class="flex flex-col items-center space-y-4">
                    <div class="flex space-x-2">
                        <div class="w-3 h-3 bg-white rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                        <div class="w-3 h-3 bg-white rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                        <div class="w-3 h-3 bg-white rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                    </div>
                    <p id="loaderStatus" class="text-purple-200 text-sm">Checking version...</p>
                </div>

                <!-- Version Info -->
                <div class="mt-8 text-purple-300 text-xs">
                    Version ${config.APP_VERSION}
                </div>
            </div>
        `;

        document.body.appendChild(loaderScreen);
        this.elements.loaderScreen = loaderScreen;
        this.elements.loaderStatus = document.getElementById('loaderStatus');
    }

    /**
     * Show the loader screen
     */
    show() {
        if (this.elements.loaderScreen) {
            this.elements.loaderScreen.classList.remove('hidden');
            this.isVisible = true;
            this.startTime = Date.now(); // Record when loader started
        }
    }

    /**
     * Hide the loader screen
     */
    hide() {
        if (this.elements.loaderScreen) {
            this.elements.loaderScreen.classList.add('hidden');
            this.isVisible = false;
        }
    }

    /**
     * Update the status message
     * @param {string} message - Status message to display
     */
    updateStatus(message) {
        if (this.elements.loaderStatus) {
            this.elements.loaderStatus.textContent = message;
        }
    }

    /**
     * Set callback for when version check is complete
     * @param {Function} callback - Callback function
     */
    setOnVersionCheckComplete(callback) {
        this.onVersionCheckComplete = callback;
    }

    /**
     * Perform version check against the server
     */
    async performVersionCheck() {
        try {
            this.updateStatus('Checking version...');

            // Get platform information
            const platform = this.getPlatformInfo();
            
            // Prepare version check payload
            const payload = {
                version: config.APP_VERSION,
                client_id: config.CLIENT_ID,
                platform: platform
            };

            console.log('Performing version check with payload:', payload);

            // Make API call to version check endpoint
            const response = await fetch(`${config.SERVER_BASE_URL}/api/versioncheck`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Version check result:', result);

            // Handle the response based on status
            await this.handleVersionCheckResult(result);

        } catch (error) {
            console.error('Version check failed:', error);
            
            // On network error, allow the app to continue
            this.updateStatus('Version check failed, continuing...');
            
            setTimeout(() => {
                this.completeVersionCheck(true);
            }, 2000);
        }
    }

    /**
     * Handle version check result
     * @param {Object} result - Server response
     */
    async handleVersionCheckResult(result) {
        const { status, message, maintenance_until } = result;

        switch (status) {
            case 'VersionCheckStatus.OK':
                this.updateStatus('Version check passed');
                setTimeout(() => {
                    this.completeVersionCheck(true);
                }, 1000);
                break;

            case 'VersionCheckStatus.OUTDATED':
                this.updateStatus('New version available');
                await this.showVersionWarning(message);
                break;

            case 'VersionCheckStatus.REQUIRED':
                this.updateStatus('Update required');
                await this.showUpdateRequired(message);
                break;

            case 'VersionCheckStatus.DOWN':
                this.updateStatus('Server maintenance');
                await this.showMaintenanceMessage(message, maintenance_until);
                break;

            default:
                console.warn('Unknown version check status:', status);
                this.updateStatus('Unknown status, continuing...');
                setTimeout(() => {
                    this.completeVersionCheck(true);
                }, 2000);
        }
    }

    /**
     * Show version warning for outdated app
     * @param {string} message - Custom message from server
     */
    async showVersionWarning(message) {
        this.hide();

        const customMessage = message || 'A new version of ZenTransfer is available. We recommend updating to get the latest features and improvements.';

        const shouldContinue = await UIComponents.Modal.confirm(
            `${customMessage}<br><br>Would you like to download the latest version now?`,
            {
                title: 'New Version Available',
                confirmText: 'Download Update',
                cancelText: 'Continue Anyway',
                type: 'info'
            }
        );

        if (shouldContinue) {
            this.openDownloadPage();
            this.completeVersionCheck(false); // Don't proceed with app
        } else {
            this.completeVersionCheck(true); // Continue with current version
        }
    }

    /**
     * Show update required message
     * @param {string} message - Custom message from server
     */
    async showUpdateRequired(message) {
        this.hide();

        const customMessage = message || 'This version of ZenTransfer is no longer supported. Please update to the latest version to continue using the app.';

        await UIComponents.Modal.confirm(
            `${customMessage}<br><br>Click "Download Update" to get the latest version.`,
            {
                title: 'Update Required',
                confirmText: 'Download Update',
                cancelText: 'Exit App',
                type: 'warning'
            }
        ).then((shouldDownload) => {
            if (shouldDownload) {
                this.openDownloadPage();
            }
            this.completeVersionCheck(false); // Don't proceed with app
        });
    }

    /**
     * Show maintenance message
     * @param {string} message - Custom message from server
     * @param {string} maintenanceUntil - Expected maintenance end time
     */
    async showMaintenanceMessage(message, maintenanceUntil) {
        this.hide();

        let maintenanceMessage = message || 'ZenTransfer is currently down for maintenance. Please try again later.';
        
        if (maintenanceUntil) {
            try {
                const maintenanceDate = new Date(maintenanceUntil);
                const formattedDate = maintenanceDate.toLocaleString();
                maintenanceMessage += `<br><br>Expected to be back online: ${formattedDate}`;
            } catch (error) {
                console.error('Failed to parse maintenance_until date:', error);
            }
        }

        await UIComponents.Modal.confirm(
            maintenanceMessage,
            {
                title: 'Server Maintenance',
                confirmText: 'Retry',
                cancelText: 'Exit',
                type: 'info'
            }
        ).then((shouldRetry) => {
            if (shouldRetry) {
                // Retry version check
                this.show();
                setTimeout(() => {
                    this.performVersionCheck();
                }, 2000);
            } else {
                this.completeVersionCheck(false); // Exit app
            }
        });
    }

    /**
     * Open the download page
     */
    openDownloadPage() {
        if (typeof require !== 'undefined') {
            // Electron environment
            try {
                const { shell } = require('electron');
                shell.openExternal('https://zentransfer.io/download/');
            } catch (error) {
                console.error('Failed to open external URL:', error);
            }
        } else {
            // Web environment
            window.open('https://zentransfer.io/download/', '_blank');
        }
    }

    /**
     * Get platform information
     * @returns {string} Platform identifier
     */
    getPlatformInfo() {
        if (typeof require !== 'undefined') {
            // Electron environment
            try {
                const os = require('os');
                const platform = os.platform();
                const arch = os.arch();
                return `${platform}-${arch}`;
            } catch (error) {
                console.error('Failed to get OS info:', error);
                return 'electron-unknown';
            }
        } else {
            // Web environment
            return `web-${navigator.platform}`;
        }
    }

    /**
     * Complete version check and notify callback
     * @param {boolean} shouldProceed - Whether the app should proceed
     */
    completeVersionCheck(shouldProceed) {
        if (!this.startTime) {
            // If no start time recorded, proceed immediately
            if (this.onVersionCheckComplete) {
                this.onVersionCheckComplete(shouldProceed);
            }
            return;
        }

        const elapsedTime = Date.now() - this.startTime;
        const remainingTime = Math.max(0, this.minDisplayTime - elapsedTime);

        if (remainingTime > 0) {
            // Wait for the remaining time before completing
            setTimeout(() => {
                if (this.onVersionCheckComplete) {
                    this.onVersionCheckComplete(shouldProceed);
                }
            }, remainingTime);
        } else {
            // Minimum time already elapsed, proceed immediately
            if (this.onVersionCheckComplete) {
                this.onVersionCheckComplete(shouldProceed);
            }
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
     * Cleanup resources when screen is destroyed
     */
    destroy() {
        if (this.elements.loaderScreen) {
            this.elements.loaderScreen.remove();
        }
        this.isVisible = false;
    }
} 