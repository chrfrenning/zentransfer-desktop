/**
 * Download Manager
 * Simple wrapper around IPC communication for download operations
 */

export class DownloadManager {
    constructor() {
        this.isMonitoring = false;
        this.callbacks = {
            onProgress: null,
            onFileFound: null,
            onCompleted: null,
            onError: null,
            onMonitoringCheck: null,
            onQueueCleared: null,
            onSyncTimeUpdate: null
        };
        
        this.initializeIPC();
    }

    /**
     * Initialize IPC communication
     */
    initializeIPC() {
        try {
            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                this.ipcRenderer = ipcRenderer;
                
                // Listen for download updates
                this.ipcRenderer.on('download-update', (event, updateData) => {
                    this.handleDownloadUpdate(updateData);
                });
                
                console.log('Download Manager: IPC initialized');
            } else {
                console.warn('Download Manager: IPC not available (not in Electron)');
            }
        } catch (error) {
            console.error('Download Manager: Failed to initialize IPC:', error);
        }
    }

    /**
     * Handle download updates from main process
     */
    handleDownloadUpdate(updateData) {
        const { type } = updateData;
        
        console.log('Download Manager: Received update:', type, updateData);
        
        switch (type) {
            case 'monitoring-check':
                if (this.callbacks.onMonitoringCheck) {
                    this.callbacks.onMonitoringCheck(updateData);
                }
                break;
                
            case 'files-found':
                if (this.callbacks.onFileFound) {
                    this.callbacks.onFileFound(updateData);
                }
                break;
                
            case 'progress':
                if (this.callbacks.onProgress) {
                    this.callbacks.onProgress(updateData);
                }
                break;
                
            case 'result':
                if (this.callbacks.onCompleted) {
                    this.callbacks.onCompleted(updateData);
                }
                break;
                
            case 'error':
            case 'monitoring-error':
                if (this.callbacks.onError) {
                    this.callbacks.onError(updateData);
                }
                break;
                
            case 'queue-cleared':
                if (this.callbacks.onQueueCleared) {
                    this.callbacks.onQueueCleared(updateData);
                }
                break;
                
            case 'sync-time-update':
                if (this.callbacks.onSyncTimeUpdate) {
                    this.callbacks.onSyncTimeUpdate(updateData);
                }
                break;
                
            default:
                console.log('Download Manager: Unknown update type:', type);
        }
    }

    /**
     * Start monitoring for downloads
     */
    async startMonitoring(downloadPath, lastSyncTime = null, authToken = null) {
        if (!this.ipcRenderer) {
            throw new Error('IPC not available');
        }
        
        if (this.isMonitoring) {
            throw new Error('Monitoring already in progress');
        }
        
        try {
            console.log('Download Manager: Starting monitoring...');
            const result = await this.ipcRenderer.invoke('start-download-monitoring', downloadPath, lastSyncTime, authToken);
            
            if (result.success) {
                this.isMonitoring = true;
                console.log('Download Manager: Monitoring started successfully');
                return result;
            } else {
                throw new Error(result.error || 'Failed to start monitoring');
            }
        } catch (error) {
            console.error('Download Manager: Failed to start monitoring:', error);
            throw error;
        }
    }

    /**
     * Stop monitoring
     */
    async stopMonitoring() {
        if (!this.ipcRenderer) {
            throw new Error('IPC not available');
        }
        
        if (!this.isMonitoring) {
            console.log('Download Manager: No monitoring in progress');
            return;
        }
        
        try {
            console.log('Download Manager: Stopping monitoring...');
            const result = await this.ipcRenderer.invoke('stop-download-monitoring');
            
            if (result.success) {
                this.isMonitoring = false;
                console.log('Download Manager: Monitoring stopped successfully');
                return result;
            } else {
                throw new Error(result.error || 'Failed to stop monitoring');
            }
        } catch (error) {
            console.error('Download Manager: Failed to stop monitoring:', error);
            throw error;
        }
    }

    /**
     * Get download statistics
     */
    async getStats() {
        if (!this.ipcRenderer) {
            return {
                totalWorkers: 0,
                busyWorkers: 0,
                queueLength: 0,
                activeJobs: 0,
                isMonitoring: false
            };
        }
        
        try {
            return await this.ipcRenderer.invoke('get-download-stats');
        } catch (error) {
            console.error('Download Manager: Failed to get stats:', error);
            return {
                totalWorkers: 0,
                busyWorkers: 0,
                queueLength: 0,
                activeJobs: 0,
                isMonitoring: false
            };
        }
    }

    /**
     * Check if monitoring is currently active
     */
    isCurrentlyMonitoring() {
        return this.isMonitoring;
    }

    /**
     * Set callback for progress updates
     */
    setProgressCallback(callback) {
        this.callbacks.onProgress = callback;
    }

    /**
     * Set callback for file found events
     */
    setFileFoundCallback(callback) {
        this.callbacks.onFileFound = callback;
    }

    /**
     * Set callback for completion events
     */
    setCompletedCallback(callback) {
        this.callbacks.onCompleted = callback;
    }

    /**
     * Set callback for error events
     */
    setErrorCallback(callback) {
        this.callbacks.onError = callback;
    }

    /**
     * Set callback for monitoring check events
     */
    setMonitoringCheckCallback(callback) {
        this.callbacks.onMonitoringCheck = callback;
    }

    /**
     * Set callback for queue cleared events
     */
    setQueueClearedCallback(callback) {
        this.callbacks.onQueueCleared = callback;
    }

    /**
     * Set callback for sync time update events
     */
    setSyncTimeUpdateCallback(callback) {
        this.callbacks.onSyncTimeUpdate = callback;
    }

    /**
     * Set all callbacks at once
     */
    setCallbacks(callbacks) {
        Object.assign(this.callbacks, callbacks);
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.ipcRenderer) {
            this.ipcRenderer.removeAllListeners('download-update');
        }
        
        this.callbacks = {
            onProgress: null,
            onFileFound: null,
            onCompleted: null,
            onError: null,
            onMonitoringCheck: null,
            onQueueCleared: null,
            onSyncTimeUpdate: null
        };
        
        console.log('Download Manager: Destroyed');
    }
} 