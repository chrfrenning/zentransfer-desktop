/**
 * Update Manager (Renderer)
 * Handles application updates through communication with main process
 */

export class AutoUpdate {
    constructor() {
        window.logger.info('AutoUpdate: Initialized');

        window.electronAPI.updater.onStatus((status, data) => {
            window.logger.info('AutoUpdate: Update status:', status, data);
            if (status === 'update-available') {
                this.updateReady = true;
            }
        });

        this.checkForUpdates();
    }
    
    /**
     * Check for updates
     * @returns {Promise<Object>} Update check result
     */
    async checkForUpdates() {
        window.logger.info('AutoUpdate: Checking for updates');
        return window.electronAPI.updater.checkForUpdates();
    }

    async quitAndInstallUpdate() {
        if (!this.updateReady) {
            window.logger.info('AutoUpdate: No update ready to install');
            return false;
        }

        window.logger.info('AutoUpdate: Installing update');
        window.electronAPI.updater.quitAndInstall();
        return true;
    }
}

// Initialize update manager and export for global access
window.updateManager = new AutoUpdate();
window.logger.info('UpdateManager: Module loaded successfully');