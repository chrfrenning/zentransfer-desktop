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
            if (window.electronAPI) {
                // Listen for download updates from main process
                this.updateCleanup = window.electronAPI.download.onUpdate((updateData) => {
                    this.handleDownloadUpdate(updateData);
                });
                
                window.logger.info('Download Manager: IPC initialized');
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
        
        window.logger.info('Download Manager: Received update:', type, updateData);
        
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
                window.logger.info('Download Manager: Unknown update type:', type);
        }
    }

    /**
     * Start monitoring for downloads
     */
    async startMonitoring(downloadPath, lastSyncTime = null, authToken = null) {
        if (!window.electronAPI) {
            throw new Error('IPC not available');
        }
        
        if (this.isMonitoring) {
            throw new Error('Monitoring already in progress');
        }
        
        try {
            window.logger.info('Download Manager: Starting monitoring...');
            const result = await window.electronAPI.download.startMonitoring(downloadPath, lastSyncTime, authToken);
            
            if (result.success) {
                this.isMonitoring = true;
                window.logger.info('Download Manager: Monitoring started successfully');
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
        if (!window.electronAPI) {
            throw new Error('IPC not available');
        }
        
        if (!this.isMonitoring) {
            window.logger.info('Download Manager: No monitoring in progress');
            return;
        }
        
        try {
            window.logger.info('Download Manager: Stopping monitoring...');
            const result = await window.electronAPI.download.stopMonitoring();
            
            if (result.success) {
                this.isMonitoring = false;
                window.logger.info('Download Manager: Monitoring stopped successfully');
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
        if (!window.electronAPI) {
            return {
                totalWorkers: 0,
                busyWorkers: 0,
                queueLength: 0,
                activeJobs: 0,
                isMonitoring: false
            };
        }
        
        try {
            return await window.electronAPI.download.getStats();
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
        if (this.updateCleanup) {
            this.updateCleanup();
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
        
        window.logger.info('Download Manager: Destroyed');
    }
} 