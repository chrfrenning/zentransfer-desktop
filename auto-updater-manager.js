/**
 * Auto-Updater Manager
 * Handles automatic application updates
 * Extracted from main.js for better modularity
 */

const { BrowserWindow, dialog, app } = require('electron');
const { autoUpdater } = require('electron-updater');

class AutoUpdaterManager {
  constructor() {
    this.setupEventHandlers();
  }
  
  // Initialize auto-updater
  initialize() {
    console.log(`Starting ZenTransfer app version ${app.getVersion()}`);
    
    // Configure auto-updater
    autoUpdater.checkForUpdatesAndNotify();
  }
  
  // Setup auto-updater event handlers
  setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
      this.sendUpdateStatusToRenderer('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info);
      this.sendUpdateStatusToRenderer('update-available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info);
      this.sendUpdateStatusToRenderer('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err);
      this.sendUpdateStatusToRenderer('error', { message: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      console.log(`Download progress: ${progressObj.percent}%`);
      this.sendUpdateStatusToRenderer('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
      this.sendUpdateStatusToRenderer('update-downloaded', info);
      
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
  
  // Helper function to send update status to renderer
  sendUpdateStatusToRenderer(status, data = null) {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('update-status', { status, data });
    });
  }
  
  // Public methods for manual update control
  async checkForUpdates() {
    return await autoUpdater.checkForUpdates();
  }
  
  async downloadUpdate() {
    return await autoUpdater.downloadUpdate();
  }
  
  quitAndInstall() {
    autoUpdater.quitAndInstall();
  }
}

module.exports = { AutoUpdaterManager }; 