/**
 * Download Screen
 * Monitors server for new files and manages download queue with two distinct modes
 */

import { UIComponents } from '../components/ui-components.js';
import { config } from '../config/app-config.js';
import { TokenManager } from '../auth/token-manager.js';
import { StorageManager } from '../components/storage-manager.js';
import { DownloadQueueManager } from '../components/download-queue-manager.js';

export class DownloadScreen {
    constructor() {
        console.log('DownloadScreen constructor called!');
        this.isVisible = false;
        this.elements = {};
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.queueManager = new DownloadQueueManager();
        this.downloadQueue = new Map(); // Track download progress
        this.maxCompletedItems = 20; // Maximum number of completed items to keep
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupQueueManager();
        this.setupDownloadManager();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            downloadTab: document.getElementById('downloadTab')
        };

        // Create the new download UI with two modes
        this.createDownloadUI();
    }

    /**
     * Create download UI with setup and monitoring modes
     */
    createDownloadUI() {
        if (!this.elements.downloadTab) return;

        // Clear existing content and add scrollable classes like other tabs
        this.elements.downloadTab.innerHTML = '';
        this.elements.downloadTab.className = 'h-full px-4 pt-2 pb-6 overflow-y-auto';

        // Create setup mode (shown when not monitoring)
        this.createSetupMode();
        
        // Create monitoring mode (shown when monitoring)
        this.createMonitoringMode();
    }

    /**
     * Create setup mode UI
     */
    createSetupMode() {
        const setupMode = document.createElement('div');
        setupMode.id = 'setupMode';
        setupMode.className = 'w-full';
        
        setupMode.innerHTML = `
            <!-- Compact Header -->
            <div class="flex items-center mt-2 mb-6 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="flex-shrink-0 mr-6">
                    <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <h2 class="text-lg font-semibold text-gray-900 leading-tight">Download</h2>
                    <p class="text-sm text-gray-600 leading-tight">Monitor and download from ZenTransfer</p>
                </div>
            </div>

            <!-- Settings -->
            <div class="max-w-2xl space-y-6">
                <!-- Download Path -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Download files to</label>
                    <div class="flex space-x-2">
                        <input 
                            type="text" 
                            id="downloadPathInput" 
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" 
                            placeholder="Select download directory..."
                            readonly
                        >
                        <button 
                            id="browsePathBtn" 
                            class="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 text-sm"
                            title="Select download directory (if supported by browser)"
                        >
                            Browse
                        </button>
                    </div>
                </div>

                <!-- Last Sync -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <span class="text-sm font-medium text-gray-700">Last Sync:</span>
                        <span id="lastSyncTime" class="text-sm text-gray-600">Never</span>
                    </div>
                    <button 
                        id="resetSyncBtn" 
                        class="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                        Reset
                    </button>
                </div>

                <!-- Start Button -->
                <button 
                    id="startMonitorBtn" 
                    class="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Start Monitoring
                </button>
            </div>
        `;

        this.elements.downloadTab.appendChild(setupMode);
        this.elements.setupMode = setupMode;
    }

    /**
     * Create monitoring mode UI
     */
    createMonitoringMode() {
        const monitoringMode = document.createElement('div');
        monitoringMode.id = 'monitoringMode';
        monitoringMode.className = 'hidden w-full';
        
        monitoringMode.innerHTML = `
            <!-- Compact Header with status and stop button -->
            <div class="flex items-center justify-between mt-2 mb-6 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0 mr-3">
                        <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2">
                            <h2 class="text-lg font-semibold text-gray-900 leading-tight">Download</h2>
                            <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                        <p class="text-sm text-green-600 leading-tight">Monitoring active</p>
                    </div>
                </div>
                <button 
                    id="stopMonitorBtn" 
                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 font-medium text-sm"
                >
                    Stop
                </button>
            </div>

            <!-- File List -->
            <div class="bg-white rounded-lg border overflow-hidden mb-6">
                <div id="fileList" class="divide-y divide-gray-200">
                    <!-- File items will be added here -->
                </div>
                <div id="emptyFileList" class="text-center py-12 text-gray-500">
                    <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                    <p>No files in queue</p>
                    <p class="text-sm">Files will appear here when detected</p>
                </div>
            </div>
        `;

        this.elements.downloadTab.appendChild(monitoringMode);
        this.elements.monitoringMode = monitoringMode;
    }

    /**
     * Cache DOM element references
     */
    cacheElements() {
        // Setup mode elements
        this.elements.downloadPathInput = document.getElementById('downloadPathInput');
        this.elements.browsePathBtn = document.getElementById('browsePathBtn');
        this.elements.startMonitorBtn = document.getElementById('startMonitorBtn');
        this.elements.lastSyncTime = document.getElementById('lastSyncTime');
        this.elements.resetSyncBtn = document.getElementById('resetSyncBtn');
        
        // Monitoring mode elements
        this.elements.stopMonitorBtn = document.getElementById('stopMonitorBtn');
        this.elements.fileList = document.getElementById('fileList');
        this.elements.emptyFileList = document.getElementById('emptyFileList');
        

    }

    /**
     * Load settings from storage
     */
    loadSettings() {
        const downloadPath = StorageManager.getDownloadPath();
        if (downloadPath && this.elements.downloadPathInput) {
            this.elements.downloadPathInput.value = downloadPath;
            this.queueManager.setDownloadPath(downloadPath);
        } else {
            // Set default download path for first-time users
            let defaultPath = 'Browser Default Downloads';
            
            // In Electron, use the system Downloads directory
            if (typeof require !== 'undefined') {
                try {
                    const path = require('path');
                    const os = require('os');
                    
                    // Use the user's Downloads directory
                    defaultPath = path.join(os.homedir(), 'Downloads', 'ZenTransfer');
                    
                    // Create the directory if it doesn't exist
                    const fs = require('fs');
                    if (!fs.existsSync(defaultPath)) {
                        fs.mkdirSync(defaultPath, { recursive: true });
                    }
                } catch (error) {
                    console.error('Failed to create default download directory:', error);
                }
            }
            
            this.elements.downloadPathInput.value = defaultPath;
            this.queueManager.setDownloadPath(defaultPath);
            StorageManager.setDownloadPath(defaultPath);
        }

        const lastSync = StorageManager.getLastSyncTime();
        this.updateLastSyncDisplay(lastSync);
        
        // Update start button state
        this.updateStartButtonState();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Cache elements first
        this.cacheElements();
        
        // Browse path button
        if (this.elements.browsePathBtn) {
            this.elements.browsePathBtn.addEventListener('click', () => {
                this.browseDownloadPath();
            });
        }

        // Start monitoring button
        if (this.elements.startMonitorBtn) {
            this.elements.startMonitorBtn.addEventListener('click', () => {
                this.startMonitoring();
            });
        }

        // Reset sync button
        if (this.elements.resetSyncBtn) {
            this.elements.resetSyncBtn.addEventListener('click', () => {
                this.resetSync();
            });
        }

        // Stop monitoring button
        if (this.elements.stopMonitorBtn) {
            this.elements.stopMonitorBtn.addEventListener('click', () => {
                this.stopMonitoring();
            });
        }
    }

    /**
     * Setup queue manager callbacks
     */
    setupQueueManager() {
        this.queueManager.setQueueUpdateCallback((queue, stats) => {
            this.updateQueueDisplay(queue, stats);
        });

        // Initial display update
        this.updateQueueDisplay(this.queueManager.getQueue(), this.queueManager.getStats());
    }

    /**
     * Setup download manager callbacks (now just handles IPC from main process)
     */
    setupDownloadManager() {
        console.log('Setting up download manager IPC listeners...');
        
        // Listen for download updates from main process
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                
                console.log('IPC renderer available, setting up download-update listener');
                
                ipcRenderer.on('download-update', (event, data) => {
                    console.log('IPC listener received download-update:', data.type);
                    this.handleDownloadUpdate(data);
                });
                
                console.log('Download IPC listener setup complete');
            } catch (error) {
                console.error('Failed to setup IPC listeners:', error);
            }
        } else {
            console.error('require() not available - cannot setup IPC listeners');
        }
    }
    
    /**
     * Handle download updates from main process
     */
    handleDownloadUpdate(data) {
        const { type } = data;
        
        console.log('Renderer received download update:', type, data);
        
        switch (type) {
            case 'monitoring-check':
                console.log('Monitoring check:', data.timestamp);
                break;
                
            case 'queue-update':
                console.log('Queue update received in renderer:', data.stats);
                this.updateQueueFromMain(data.files, data.stats);
                break;
                
            case 'queue-cleared':
                console.log('Download queue cleared:', data.message);
                UIComponents.Notification.show(data.message, 'info');
                break;
                
            case 'sync-time-update':
                console.log('Sync time updated:', data.syncTime);
                StorageManager.setLastSyncTime(data.syncTime);
                this.updateLastSyncDisplay(data.syncTime);
                break;
                
            case 'monitoring-error':
                console.error('Monitoring error:', data.error);
                UIComponents.Notification.show('Monitoring error: ' + data.error, 'error');
                break;
                
            default:
                console.log('Unknown download update type:', type, data);
        }
    }

    /**
     * Switch between setup and monitoring modes
     * @param {boolean} isMonitoring - Whether monitoring is active
     */
    switchMode(isMonitoring) {
        if (isMonitoring) {
            // Show monitoring mode, hide setup mode
            if (this.elements.setupMode) {
                this.elements.setupMode.classList.add('hidden');
            }
            if (this.elements.monitoringMode) {
                this.elements.monitoringMode.classList.remove('hidden');
            }
            
            // Re-cache elements now that monitoring mode is visible
            this.cacheElements();
        } else {
            // Show setup mode, hide monitoring mode
            if (this.elements.monitoringMode) {
                this.elements.monitoringMode.classList.add('hidden');
            }
            if (this.elements.setupMode) {
                this.elements.setupMode.classList.remove('hidden');
            }
        }
    }

    /**
     * Browse for download directory
     */
    async browseDownloadPath() {
        try {
            // Check if we're in Electron environment
            if (typeof require !== 'undefined') {
                try {
                    // Try to access electron APIs directly
                    const { ipcRenderer } = require('electron');
                    
                    // Send request to main process to show directory dialog
                    const selectedPath = await ipcRenderer.invoke('show-directory-dialog');
                    
                    if (selectedPath) {
                        this.elements.downloadPathInput.value = selectedPath;
                        this.queueManager.setDownloadPath(selectedPath);
                        this.updateStartButtonState();
                        UIComponents.Notification.show('Download directory selected: ' + selectedPath, 'success');
                    }
                    return;
                } catch (error) {
                    console.log('IPC not available, trying direct access');
                    
                    // Fallback: try to use a simple prompt for path input
                    const path = prompt('Enter download directory path:', this.elements.downloadPathInput.value || '');
                    
                    if (path && path.trim()) {
                        const trimmedPath = path.trim();
                        
                        // Verify the path exists using Node.js fs
                        try {
                            const fs = require('fs');
                            if (fs.existsSync(trimmedPath)) {
                                this.elements.downloadPathInput.value = trimmedPath;
                                this.queueManager.setDownloadPath(trimmedPath);
                                this.updateStartButtonState();
                                UIComponents.Notification.show('Download directory set: ' + trimmedPath, 'success');
                                return;
                            } else {
                                UIComponents.Notification.show('Directory does not exist: ' + trimmedPath, 'error');
                                return;
                            }
                        } catch (fsError) {
                            console.error('File system access error:', fsError);
                        }
                    }
                }
            }
            
            // Check if File System Access API is available (modern browsers)
            if ('showDirectoryPicker' in window) {
                try {
                    const directoryHandle = await window.showDirectoryPicker();
                    const path = directoryHandle.name;
                    
                    this.elements.downloadPathInput.value = path;
                    this.queueManager.setDownloadPath(path);
                    this.updateStartButtonState();
                    UIComponents.Notification.show('Download directory selected: ' + path, 'success');
                    return;
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Directory picker failed:', err);
                    }
                    // Fall through to alternative method
                }
            }
            
            // Fallback: Use browser's default download directory
            const useDefault = confirm(
                'Your browser doesn\'t support directory selection.\n\n' +
                'Would you like to use the browser\'s default download directory?\n\n' +
                'Files will be downloaded to your browser\'s default download folder.'
            );
            
            if (useDefault) {
                const defaultPath = 'Browser Default Downloads';
                this.elements.downloadPathInput.value = defaultPath;
                this.queueManager.setDownloadPath(defaultPath);
                this.updateStartButtonState();
                UIComponents.Notification.show('Using browser default download directory', 'success');
            }
            
        } catch (error) {
            console.error('Failed to browse path:', error);
            UIComponents.Notification.show('Failed to set download path', 'error');
        }
    }

    /**
     * Update start button state
     */
    updateStartButtonState() {
        if (this.elements.startMonitorBtn) {
            const hasPath = this.queueManager.downloadPath && this.queueManager.downloadPath.trim();
            this.elements.startMonitorBtn.disabled = !hasPath;
        }
    }

    /**
     * Reset sync time to start from beginning
     */
    async resetSync() {
        if (confirm('Reset sync time? This will re-download all files from the beginning.')) {
            const resetTime = '2025-01-01T00:00:00.000Z';
            StorageManager.setLastSyncTime(resetTime);
            this.updateLastSyncDisplay(resetTime);
            
            // Also reset the sync time in the main process (clears both lastSyncTime and latestDownloadedFileTime)
            if (typeof require !== 'undefined') {
                try {
                    const { ipcRenderer } = require('electron');
                    await ipcRenderer.invoke('reset-sync-time', resetTime);
                    console.log('Sync time reset in main process');
                } catch (error) {
                    console.error('Failed to reset sync time in main process:', error);
                }
            }
            
            UIComponents.Notification.show('Sync time reset', 'success');
        }
    }

    /**
     * Start monitoring for new files
     */
    async startMonitoring() {
        if (this.isMonitoring) return;

        const downloadPath = this.queueManager.downloadPath;
        if (!downloadPath) {
            UIComponents.Notification.show('Please set a download directory first', 'error');
            return;
        }

        try {
            this.isMonitoring = true;
            this.switchMode(true);
            
            // Get last sync time from storage
            const lastSyncTime = StorageManager.getLastSyncTime();
            
            // Get authentication token
            const tokenResult = await TokenManager.ensureValidToken();
            if (!tokenResult.valid) {
                throw new Error('Authentication required. Please log in again.');
            }
            
            // Start monitoring via main process
            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('start-download-monitoring', downloadPath, lastSyncTime, tokenResult.token);
                
                if (!result.success) {
                    throw new Error(result.error);
                }
            }
            
            UIComponents.Notification.show('File monitoring started', 'success');
            
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            UIComponents.Notification.show('Failed to start monitoring: ' + error.message, 'error');
            this.stopMonitoring();
        }
    }

    /**
     * Stop monitoring for new files
     */
    async stopMonitoring() {
        if (!this.isMonitoring) return;

        try {
            this.isMonitoring = false;
            this.switchMode(false);

            // Stop monitoring via main process
            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('stop-download-monitoring');
                
                if (!result.success) {
                    console.error('Failed to stop monitoring:', result.error);
                }
            }

            UIComponents.Notification.show('File monitoring stopped', 'info');
        } catch (error) {
            console.error('Failed to stop monitoring:', error);
            UIComponents.Notification.show('Failed to stop monitoring: ' + error.message, 'error');
        }
    }

    /**
     * Update queue from main process data
     */
    updateQueueFromMain(files, stats) {
        // Clear current queue and rebuild from main process data
        this.downloadQueue.clear();
        
        // Add all files to the queue
        files.forEach(file => {
            this.downloadQueue.set(file.id, file);
        });
        
        // Update display
        this.updateFileListWithOrdering();
        this.updateStatsFromData(stats);
    }

    /**
     * Update statistics display from provided data (stats grid removed)
     */
    updateStatsFromData(stats) {
        // Stats grid has been removed - this method is kept for compatibility
        console.log('Stats update (grid removed):', stats);
    }

    /**
     * Update statistics display (legacy method - now uses main process data)
     */
    updateStats() {
        // This method is kept for compatibility but stats are now managed by main process
        // The actual stats updates come through updateStatsFromData()
        console.log('updateStats() called - stats are now managed by main process');
    }



    /**
     * Update last sync time display
     * @param {string} isoDateTime - ISO format datetime
     */
    updateLastSyncDisplay(isoDateTime) {
        if (this.elements.lastSyncTime) {
            if (isoDateTime === '2025-01-01T00:00:00.000Z') {
                this.elements.lastSyncTime.textContent = 'Never';
            } else {
                const date = new Date(isoDateTime);
                this.elements.lastSyncTime.textContent = date.toLocaleString();
            }
        }
    }

    /**
     * Update queue display
     * @param {Array} queue - Current queue (unused, kept for compatibility)
     * @param {Object} stats - Queue statistics (unused, kept for compatibility)
     */
    updateQueueDisplay(queue, stats) {
        // Use our own stats calculation instead of the passed stats
        this.updateStats();
        
        // Update file list with proper ordering
        this.updateFileListWithOrdering();
    }

    /**
     * Update file list display with proper ordering
     */
    updateFileListWithOrdering() {
        if (!this.elements.fileList || !this.elements.emptyFileList) return;

        const files = Array.from(this.downloadQueue.values());
        
        // Filter to only show downloading files and completed/failed history
        // Hide queued items since they're just waiting
        const visibleFiles = files.filter(file => 
            file.status === 'downloading' || 
            file.status === 'completed' || 
            file.status === 'failed'
        );
        
        // Sort files: downloading first (newest first), then completed/failed (newest first)
        const sortedFiles = visibleFiles.sort((a, b) => {
            // First, group by status priority
            const statusPriority = {
                'downloading': 1,
                'completed': 2,
                'failed': 3
            };
            
            const aPriority = statusPriority[a.status] || 4;
            const bPriority = statusPriority[b.status] || 4;
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            // Within same status group, sort by time (newest first)
            if (a.status === 'downloading') {
                // For active downloads, sort by when they were added (newest first)
                return (b.addedAt || 0) - (a.addedAt || 0);
            } else {
                // For completed/failed, sort by completion time (newest first)
                return (b.completedAt || b.addedAt || 0) - (a.completedAt || a.addedAt || 0);
            }
        });

        this.updateFileList(sortedFiles);
    }

    /**
     * Update file list display
     * @param {Array} queue - Current queue
     */
    updateFileList(queue) {
        if (!this.elements.fileList || !this.elements.emptyFileList) return;

        this.elements.fileList.innerHTML = '';

        if (queue.length === 0) {
            this.elements.emptyFileList.classList.remove('hidden');
        } else {
            this.elements.emptyFileList.classList.add('hidden');
            
            queue.forEach(file => {
                const fileElement = this.createFileListItem(file);
                this.elements.fileList.appendChild(fileElement);
            });
        }
    }



    /**
     * Create compact file list item
     * @param {Object} file - File object
     * @returns {HTMLElement} File element
     */
    createFileListItem(file) {
        const element = document.createElement('div');
        element.className = 'p-4 hover:bg-gray-50 cursor-pointer';
        
        const statusClass = this.getStatusClass(file.status);
        const thumbnailUrl = file.thumbnail_url || this.getDefaultThumbnail(file);

        element.innerHTML = `
            <div class="flex items-center space-x-4">
                <!-- Thumbnail -->
                <div class="flex-shrink-0">
                    <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border-2 ${statusClass}">
                        <img 
                            src="${thumbnailUrl}" 
                            alt="${file.name}"
                            class="w-full h-full object-cover"
                            onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNiAxNkgyNFYyNEgxNlYxNloiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'"
                        >
                    </div>
                </div>
                
                <!-- File Info -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <p class="text-sm font-medium text-gray-900 truncate">${file.name}</p>
                        <span class="ml-2 px-2 py-1 text-xs rounded-full ${this.getStatusBadgeClass(file.status)}">
                            ${file.status}
                        </span>
                    </div>
                    <div class="flex items-center space-x-4 mt-1">
                        <p class="text-xs text-gray-500">${this.formatFileSize(file.size || 0)}</p>
                        <p class="text-xs text-gray-500">${file.type || 'Unknown'}</p>
                        ${file.created ? `<p class="text-xs text-gray-500">${new Date(file.created).toLocaleDateString()}</p>` : ''}
                    </div>
                    ${file.status === 'downloading' && file.progress !== undefined ? `
                        <div class="mt-2">
                            <div class="flex justify-between text-xs text-gray-600 mb-1">
                                <span>${file.progress}%</span>
                                <span>${this.formatFileSize(file.downloadedBytes || 0)} / ${this.formatFileSize(file.totalBytes || file.size || 0)}</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${file.progress || 0}%"></div>
                            </div>
                        </div>
                    ` : ''}
                    ${file.error ? `<p class="text-xs text-red-600 mt-1">${file.error}</p>` : ''}
                </div>
                
                <!-- Status Indicator -->
                <div class="flex-shrink-0">
                    ${file.status === 'downloading' ? 
                        '<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>' : 
                        this.getStatusIcon(file.status)
                    }
                </div>
            </div>
        `;

        // Add click handler for removal
        element.addEventListener('click', () => {
            if (file.status === 'completed' || file.status === 'failed') {
                if (confirm(`Remove "${file.name}" from queue?`)) {
                    this.queueManager.removeFile(file.id);
                }
            }
        });

        return element;
    }

    /**
     * Get status border class
     * @param {string} status - File status
     * @returns {string} CSS class
     */
    getStatusClass(status) {
        switch (status) {
            case 'queued': return 'border-yellow-300';
            case 'downloading': return 'border-blue-500';
            case 'completed': return 'border-green-500';
            case 'failed': return 'border-red-500';
            default: return 'border-gray-300';
        }
    }

    /**
     * Get status badge class
     * @param {string} status - File status
     * @returns {string} CSS class
     */
    getStatusBadgeClass(status) {
        switch (status) {
            case 'queued': return 'bg-yellow-100 text-yellow-800';
            case 'downloading': return 'bg-blue-100 text-blue-800';
            case 'completed': return 'bg-green-100 text-green-800';
            case 'failed': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    /**
     * Get status icon
     * @param {string} status - File status
     * @returns {string} HTML for status icon
     */
    getStatusIcon(status) {
        switch (status) {
            case 'queued':
                return `<svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>`;
            case 'completed':
                return `<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>`;
            case 'failed':
                return `<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>`;
            default:
                return '';
        }
    }

    /**
     * Get default thumbnail for file type
     * @param {Object} file - File object
     * @returns {string} Default thumbnail URL
     */
    getDefaultThumbnail(file) {
        // Return a simple SVG placeholder
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNiAxNkgyNFYyNEgxNlYxNloiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Show the download screen
     */
    show() {
        if (this.elements.downloadTab) {
            this.elements.downloadTab.classList.remove('hidden');
            this.isVisible = true;
            
            // Load settings and update UI
            this.loadSettings();
            
            // Update display - stats will be updated when main process sends queue updates
            this.updateFileListWithOrdering();
            
            // Switch to appropriate mode
            this.switchMode(this.isMonitoring);
        }
    }

    /**
     * Hide the download screen
     */
    hide() {
        if (this.elements.downloadTab) {
            this.elements.downloadTab.classList.add('hidden');
            this.isVisible = false;
        }
        
        // Don't stop monitoring when hiding - let it run in background
        // Only stop when user explicitly clicks Stop button
    }

    /**
     * Check if screen is currently visible
     * @returns {boolean} True if visible
     */
    isScreenVisible() {
        return this.isVisible;
    }

    /**
     * Get download statistics
     * @returns {Object} Download stats
     */
    getDownloadStats() {
        return {
            isMonitoring: this.isMonitoring,
            queueStats: this.queueManager.getStats()
        };
    }

    /**
     * Cleanup resources when screen is destroyed
     */
    destroy() {
        this.stopMonitoring();
        this.isVisible = false;
    }
}