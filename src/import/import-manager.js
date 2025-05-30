/**
 * Import Manager
 * Simple wrapper around IPC communication for import operations
 */

export class ImportManager {
    constructor(uploadManager) {
        this.uploadManager = uploadManager;
        this.isImporting = false;
        this.callbacks = {
            onProgress: null,
            onLog: null,
            onCompleted: null,
            onError: null,
            onCancelled: null
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
                
                // Listen for import updates from main process
                this.ipcRenderer.on('import-update', (event, data) => {
                    this.handleImportUpdate(data);
                });
                
                console.log('Import manager IPC initialized');
            } else {
                throw new Error('IPC not available - not in Electron environment');
            }
        } catch (error) {
            console.error('Failed to initialize import IPC:', error);
            throw error;
        }
    }

    /**
     * Handle import updates from main process
     */
    handleImportUpdate(data) {
        const { type } = data;

        switch (type) {
            case 'progress':
                if (this.callbacks.onProgress) {
                    this.callbacks.onProgress(data);
                }
                break;

            case 'log':
                if (this.callbacks.onLog) {
                    this.callbacks.onLog(data.message);
                }
                break;

            case 'upload-ready':
                this.handleUploadReady(data);
                break;

            case 'completed':
                this.isImporting = false;
                if (this.callbacks.onCompleted) {
                    this.callbacks.onCompleted(data);
                }
                break;

            case 'error':
                this.isImporting = false;
                if (this.callbacks.onError) {
                    this.callbacks.onError(data);
                }
                break;

            case 'cancelled':
                this.isImporting = false;
                if (this.callbacks.onCancelled) {
                    this.callbacks.onCancelled(data);
                }
                break;

            default:
                console.warn('Unknown import update type:', type);
        }
    }

    /**
     * Start an import operation
     */
    async startImport(importSettings) {
        if (this.isImporting) {
            throw new Error('Import already in progress');
        }

        try {
            // Validate settings
            this.validateImportSettings(importSettings);

            this.isImporting = true;
            
            const result = await this.ipcRenderer.invoke('start-import', importSettings);
            if (!result.success) {
                this.isImporting = false;
                throw new Error(result.error);
            }
            
            return result.result;
        } catch (error) {
            this.isImporting = false;
            throw error;
        }
    }

    /**
     * Cancel the current import operation
     */
    async cancelImport() {
        if (!this.isImporting) {
            throw new Error('No import in progress');
        }

        try {
            const result = await this.ipcRenderer.invoke('cancel-import');
            if (!result.success) {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to cancel import:', error);
            throw error;
        }
    }

    /**
     * Check if import is currently running
     */
    isCurrentlyImporting() {
        return this.isImporting;
    }

    /**
     * Set callback functions for import events
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Validate import settings
     */
    validateImportSettings(settings) {
        if (!settings.sourcePath) {
            throw new Error('Source path is required');
        }

        if (!settings.destinationPath) {
            throw new Error('Destination path is required');
        }

        if (settings.backupEnabled && !settings.backupPath) {
            throw new Error('Backup path is required when backup is enabled');
        }

        if (settings.organizeIntoFolders && 
            settings.folderOrganizationType === 'custom' && 
            !settings.customFolderName) {
            throw new Error('Custom folder name is required when using custom folder organization');
        }
    }

    /**
     * Handle upload ready notification
     */
    async handleUploadReady(data) {
        const { filePaths, count, uploadServices, importSettings } = data;
        
        if (!this.uploadManager) {
            console.warn('Upload manager not available for cloud uploads');
            if (this.callbacks.onLog) {
                this.callbacks.onLog('Upload manager not available - files not queued for upload');
            }
            return;
        }

        if (!uploadServices || uploadServices.length === 0) {
            if (this.callbacks.onLog) {
                this.callbacks.onLog('No upload services enabled - skipping upload queue');
            }
            return;
        }

        try {
            if (this.callbacks.onLog) {
                const serviceNames = uploadServices.map(s => s.name).join(', ');
                this.callbacks.onLog(`Queuing ${count} files for upload to: ${serviceNames}`);
            }

            // Queue files for upload to each enabled service
            for (const service of uploadServices) {
                try {
                    // Set the upload manager to use the specific service
                    this.uploadManager.setSelectedService(service.type);
                    
                    // Queue files for upload using the upload manager with import settings
                    await this.uploadManager.addFilesFromImport(filePaths, { 
                        serviceType: service.type,
                        serviceName: service.name,
                        importSettings: importSettings  // Pass folder organization settings
                    });
                    
                    if (this.callbacks.onLog) {
                        this.callbacks.onLog(`✓ ${count} files queued for upload to ${service.name}`);
                    }
                } catch (serviceError) {
                    console.error(`Failed to queue files for ${service.name}:`, serviceError);
                    if (this.callbacks.onLog) {
                        this.callbacks.onLog(`✗ Failed to queue files for ${service.name}: ${serviceError.message}`);
                    }
                }
            }
            
        } catch (error) {
            console.error('Failed to handle upload ready:', error);
            if (this.callbacks.onLog) {
                this.callbacks.onLog(`Failed to queue files for upload: ${error.message}`);
            }
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.ipcRenderer) {
            this.ipcRenderer.removeAllListeners('import-update');
            this.ipcRenderer = null;
        }
        
        this.isImporting = false;
        this.callbacks = {};
    }
} 