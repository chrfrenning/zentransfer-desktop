const { ipcRenderer } = require('electron');

class UpdateManager {
  constructor() {
    this.notification = null;
    this.message = null;
    this.progress = null;
    this.progressBar = null;
    this.progressText = null;
    this.downloadBtn = null;
    this.installBtn = null;
    this.dismissBtn = null;
    
    this.currentUpdateInfo = null;
    this.isUpdateAvailable = false;
    this.isDownloading = false;
    this.isUpdateReady = false;
    
    this.init();
  }
  
  init() {
    // Get DOM elements
    this.notification = document.getElementById('updateNotification');
    this.message = document.getElementById('updateMessage');
    this.progress = document.getElementById('updateProgress');
    this.progressBar = document.getElementById('updateProgressBar');
    this.progressText = document.getElementById('updateProgressText');
    this.downloadBtn = document.getElementById('updateDownloadBtn');
    this.installBtn = document.getElementById('updateInstallBtn');
    this.dismissBtn = document.getElementById('updateDismissBtn');
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Listen for update status from main process
    this.setupIpcListeners();
    
    console.log('Update manager initialized');
  }
  
  setupEventListeners() {
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => {
        this.downloadUpdate();
      });
    }
    
    if (this.installBtn) {
      this.installBtn.addEventListener('click', () => {
        this.installUpdate();
      });
    }
    
    if (this.dismissBtn) {
      this.dismissBtn.addEventListener('click', () => {
        this.hideNotification();
      });
    }
  }
  
  setupIpcListeners() {
    // Listen for update status from main process
    ipcRenderer.on('update-status', (event, { status, data }) => {
      console.log('Update status received:', status, data);
      this.handleUpdateStatus(status, data);
    });
  }
  
  handleUpdateStatus(status, data) {
    switch (status) {
      case 'checking-for-update':
        this.showNotification('Checking for updates...', 'info');
        break;
        
      case 'update-available':
        this.currentUpdateInfo = data;
        this.isUpdateAvailable = true;
        this.showNotification(
          `Update available: v${data.version}`, 
          'update-available'
        );
        break;
        
      case 'update-not-available':
        // Don't show notification for no updates available
        // Only log it
        console.log('No updates available');
        break;
        
      case 'download-progress':
        this.isDownloading = true;
        this.showDownloadProgress(data);
        break;
        
      case 'update-downloaded':
        this.isDownloading = false;
        this.isUpdateReady = true;
        this.showNotification(
          'Update downloaded and ready to install!', 
          'update-ready'
        );
        break;
        
      case 'error':
        this.showNotification(
          `Update error: ${data.message}`, 
          'error'
        );
        break;
    }
  }
  
  showNotification(message, type = 'info') {
    if (!this.notification || !this.message) return;
    
    this.message.textContent = message;
    this.notification.classList.remove('hidden');
    
    // Update UI based on type
    this.updateUIForType(type);
  }
  
  updateUIForType(type) {
    // Hide all buttons first
    if (this.downloadBtn) this.downloadBtn.classList.add('hidden');
    if (this.installBtn) this.installBtn.classList.add('hidden');
    if (this.progress) this.progress.classList.add('hidden');
    
    switch (type) {
      case 'update-available':
        if (this.downloadBtn) this.downloadBtn.classList.remove('hidden');
        break;
        
      case 'update-ready':
        if (this.installBtn) this.installBtn.classList.remove('hidden');
        break;
        
      case 'downloading':
        if (this.progress) this.progress.classList.remove('hidden');
        break;
    }
  }
  
  showDownloadProgress(progressData) {
    if (!this.progress || !this.progressBar || !this.progressText) return;
    
    this.showNotification('Downloading update...', 'downloading');
    
    const percent = Math.round(progressData.percent || 0);
    this.progressBar.style.width = `${percent}%`;
    this.progressText.textContent = `Downloading... ${percent}%`;
    
    if (progressData.bytesPerSecond) {
      const speed = this.formatBytes(progressData.bytesPerSecond);
      this.progressText.textContent += ` (${speed}/s)`;
    }
  }
  
  hideNotification() {
    if (this.notification) {
      this.notification.classList.add('hidden');
    }
  }
  
  async checkForUpdates() {
    try {
      const result = await ipcRenderer.invoke('check-for-updates');
      if (!result.success) {
        console.error('Failed to check for updates:', result.error);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }
  
  async downloadUpdate() {
    if (!this.isUpdateAvailable) return;
    
    try {
      this.showNotification('Starting download...', 'downloading');
      const result = await ipcRenderer.invoke('download-update');
      if (!result.success) {
        this.showNotification(`Download failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error downloading update:', error);
      this.showNotification(`Download failed: ${error.message}`, 'error');
    }
  }
  
  async installUpdate() {
    if (!this.isUpdateReady) return;
    
    try {
      await ipcRenderer.invoke('quit-and-install');
    } catch (error) {
      console.error('Error installing update:', error);
      this.showNotification(`Install failed: ${error.message}`, 'error');
    }
  }
  
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateManager;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
  window.UpdateManager = UpdateManager;
} 