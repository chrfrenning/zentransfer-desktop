/**
 * Auto-Updater Manager
 * Handles automatic application updates
 * Extracted from main.js for better modularity
 */

const { BrowserWindow, dialog, app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { logger } = require('../utils/Logger.js');

class ZenTransferGitHubAutoUpdater {
  constructor(forceUpdateInDevMode = false) {
    //this.setupEventHandlers();
    autoUpdater.forceDevUpdateConfig = forceUpdateInDevMode;
  }
  
  // Setup auto-updater event handlers
  setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      logger.info('Checking for update...');
      //this.sendUpdateStatusToRenderer('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
      logger.info('Update available:', info);
      //this.sendUpdateStatusToRenderer('update-available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.info('Update not available:', info);
      //this.sendUpdateStatusToRenderer('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err);
      //this.sendUpdateStatusToRenderer('error', { message: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      logger.info(`Download progress: ${progressObj.percent}%`);
      //this.sendUpdateStatusToRenderer('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded:', info);
      //this.sendUpdateStatusToRenderer('update-downloaded', info);
      
      // Show dialog to user asking if they want to restart and install
      dialog.showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: 'Update downloaded. The application will restart to apply the update.',
        buttons: ['Restart Now', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }
  
  // Public methods for manual update control
  async checkForUpdates() {
    return await autoUpdater.checkForUpdates();
  }
  
  // Initialize auto-updater
  checkForUpdatesAndNotify() {
    autoUpdater.checkForUpdatesAndNotify();
  }
  
  async downloadUpdate() {
    return await autoUpdater.downloadUpdate();
  }
  
  quitAndInstall() {
    autoUpdater.quitAndInstall();
  }
}

module.exports = { ZenTransferGitHubAutoUpdater };