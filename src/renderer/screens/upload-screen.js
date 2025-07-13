/**
 * Upload Screen
 * Handles file upload UI and drag-and-drop functionality with two distinct modes
 */

import { UIComponents } from '../components/ui-components.js';
import { config } from '../config/app-config.js';
import { TokenManager } from '../auth/token-manager.js';
import { uploadServiceFactory } from '../upload/upload-service-factory.js';

export class UploadScreen {
    constructor(uploadManager) {
        this.uploadManager = uploadManager;
        this.isVisible = false;
        this.isDragOver = false;
        this.elements = {};
        this.fileInput = null;
        this.selectedService = 'zentransfer'; // Default to ZenTransfer
        this.availableServices = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.createFileInput();
        this.updateAvailableServices().then(() => {
            // Set initial service in upload manager
            if (this.uploadManager && this.selectedService) {
                this.uploadManager.setSelectedService(this.selectedService);
            }
        });
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            uploadTab: document.getElementById('uploadTab'),
            emptyState: null,
            queueState: null,
            dropOverlay: null
        };

        // Create the new UI structure
        this.createUploadUI();
    }

    /**
     * Create upload UI elements with two distinct modes
     */
    createUploadUI() {
        if (!this.elements.uploadTab) return;

        // Clear existing content and add scrollable classes
        this.elements.uploadTab.innerHTML = '';
        this.elements.uploadTab.className = 'h-full px-4 pt-2 pb-6 overflow-y-auto';

        // Create empty state (shown when no files in queue)
        this.createEmptyState();
        
        // Create queue state (shown when files are in queue)
        this.createQueueState();
        
        // Create full-screen drop overlay
        this.createDropOverlay();
    }

    /**
     * Create empty state UI
     */
    createEmptyState() {
        const emptyState = document.createElement('div');
        emptyState.id = 'emptyState';
        emptyState.className = 'flex flex-col items-center justify-center min-h-[60vh] text-center transition-all duration-300 rounded-lg';
        
        emptyState.innerHTML = `
            <!-- Upload Area -->
            <div id="emptyStateUploadArea" class="cursor-pointer transition-all duration-300 hover:bg-gray-50 rounded-lg p-8">
                <div class="upload-icon-container mb-6 flex justify-center">
                    <div class="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105">
                        <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                    </div>
                </div>
                <h2 class="text-2xl font-semibold text-gray-900 mb-2">Drop files here to upload</h2>
                <p class="text-gray-600 mb-4">Or click to browse files</p>
            </div>
            
            <!-- Service Selection -->
            <div id="emptyStateServiceSelector" class="w-full max-w-md">
                <!-- Service selector will be populated by updateServiceSelectionUI -->
            </div>
        `;

        this.elements.uploadTab.appendChild(emptyState);
        this.elements.emptyState = emptyState;

        // Add click handler for file selection on the upload area only
        const uploadArea = emptyState.querySelector('#emptyStateUploadArea');
        if (uploadArea) {
            uploadArea.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openFileDialog();
            });
        }
    }

    /**
     * Create queue state UI
     */
    createQueueState() {
        const queueState = document.createElement('div');
        queueState.id = 'queueState';
        queueState.className = 'hidden w-full';
        
        queueState.innerHTML = `
            <!-- Compact Header -->
            <div class="flex items-center mt-2 mb-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="flex-shrink-0 mr-6">
                    <div id="headerUploadIcon" class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <h2 class="text-lg font-semibold text-gray-900 leading-tight">Upload</h2>
                    <p class="text-sm text-gray-600 leading-tight">Send files using selected service</p>
                </div>
            </div>

            <!-- Service Selection (hidden when there are uploads) -->
            <div id="queueStateServiceSelector" class="mb-4 hidden">
                <!-- Service selector will be populated by updateServiceSelectionUI -->
            </div>

            <!-- Stats Grid -->
            <div id="queueStats" class="flex w-full gap-4 mb-4">
                <div class="flex-1 text-center p-4 bg-gray-50 rounded-lg">
                    <div class="font-semibold text-2xl text-gray-900" id="queuedCount">0</div>
                    <div class="text-sm text-gray-600">Queued</div>
                </div>
                <div class="flex-1 text-center p-4 bg-green-50 rounded-lg">
                    <div class="font-semibold text-2xl text-green-600" id="completedCount">0</div>
                    <div class="text-sm text-gray-600">Completed</div>
                </div>
                <div class="flex-1 text-center p-4 bg-red-50 rounded-lg">
                    <div class="font-semibold text-2xl text-red-600" id="failedCount">0</div>
                    <div class="text-sm text-gray-600">Failed</div>
                </div>
            </div>
            
            <!-- Active Uploads Progress -->
            <div id="activeUploadsProgress" class="mb-6">
                
                <div id="activeUploadsList" class="space-y-4">
                    <!-- Individual upload progress bars will be inserted here -->
                </div>
            </div>

            <!-- Upload More Files Link -->
            <div class="text-center mt-6 space-y-3">
                <button id="uploadMoreFilesBtn" class="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Upload more files...
                </button>
                <div id="stopAllUploadsContainer" class="hidden">
                    <button id="stopAllUploadsBtn" class="text-sm text-red-600 hover:text-red-800 hover:underline transition-all duration-200 focus:outline-none focus:underline">
                        Stop all uploads
                    </button>
                </div>
                <div id="clearHistoryContainer" class="hidden">
                    <button id="clearHistoryBtn" class="text-sm text-gray-600 hover:text-gray-800 hover:underline transition-all duration-200 focus:outline-none focus:underline">
                        Clear History
                    </button>
                </div>
            </div>
        `;

        this.elements.uploadTab.appendChild(queueState);
        this.elements.queueState = queueState;
    }

    /**
     * Create full-screen drop overlay
     */
    createDropOverlay() {
        const dropOverlay = document.createElement('div');
        dropOverlay.id = 'dropOverlay';
        dropOverlay.className = 'fixed inset-0 bg-blue-500 bg-opacity-90 z-50 hidden flex items-center justify-center';
        
        dropOverlay.innerHTML = `
            <div class="text-center text-white">
                <div class="mb-6">
                    <div class="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto animate-bounce">
                        <svg class="w-16 h-16 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                    </div>
                </div>
                <h2 class="text-4xl font-bold mb-4">Drop files to upload</h2>
                <p class="text-xl opacity-90">Release to add files to the queue</p>
            </div>
        `;

        document.body.appendChild(dropOverlay);
        this.elements.dropOverlay = dropOverlay;
    }

    /**
     * Create file selection handler (native Electron dialog)
     */
    createFileInput() {
        // No longer creating HTML file input - using native Electron dialog
        console.log('Upload screen: Using native Electron file dialog');
    }

    /**
     * Open native file dialog for file selection
     */
    async openFileDialog() {
        console.log('=== OPENING NATIVE FILE DIALOG ===');
        
        // Check if any services are available
        if (this.availableServices.length === 0) {
            UIComponents.Notification.show('No upload services available. Please log in or configure services in Settings.', 'warning');
            return;
        }
        
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                
                // Use native Electron file dialog
                const result = await ipcRenderer.invoke('show-file-dialog', {
                    properties: ['openFile', 'multiSelections'],
                    title: 'Select files to upload',
                    filters: [
                        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'raw', 'cr2', 'nef', 'arw', 'dng'] },
                        { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v'] },
                        { name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'] },
                        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                });
                
                if (result && result.length > 0) {
                    console.log('Files selected via native dialog:', result);
                    
                    try {
                        console.log('Calling uploadManager.addFiles with file paths...');
                        await this.uploadManager.addFiles(result);
                        console.log('uploadManager.addFiles completed');
                    } catch (error) {
                        console.error('Error calling uploadManager.addFiles:', error);
                        UIComponents.Notification.show('Failed to add files: ' + error.message, 'error');
                    }
                } else {
                    console.log('No files selected or dialog cancelled');
                }
                
            } catch (error) {
                console.error('Native file dialog failed:', error);
                UIComponents.Notification.show('Failed to open file dialog', 'error');
            }
        } else {
            // Fallback for non-Electron environments
            console.log('Not in Electron environment, using HTML file input fallback');
            this.createHTMLFileInputFallback();
        }
        
        console.log('=== END NATIVE FILE DIALOG ===');
    }

    /**
     * Create HTML file input fallback for non-Electron environments
     */
    createHTMLFileInputFallback() {
        if (!this.fileInput) {
            this.fileInput = document.createElement('input');
            this.fileInput.type = 'file';
            this.fileInput.multiple = true;
            this.fileInput.style.display = 'none';
            this.fileInput.id = 'upload-file-input';
            document.body.appendChild(this.fileInput);

            this.fileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    try {
                        await this.uploadManager.addFiles(e.target.files);
                    } catch (error) {
                        console.error('Error calling uploadManager.addFiles:', error);
                        UIComponents.Notification.show('Failed to add files: ' + error.message, 'error');
                    }
                    e.target.value = ''; // Reset input
                }
            });
        }
        
        this.fileInput.click();
    }

    /**
     * Setup event listeners for upload screen
     */
    setupEventListeners() {
        // Global drag and drop handlers for full-screen drop zone
        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (this.isVisible && !this.isDragOver) {
                this.showDropOverlay();
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            // Only hide if we're leaving the document entirely
            if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
                this.hideDropOverlay();
            }
        });

        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.hideDropOverlay();
            
            if (this.isVisible && e.dataTransfer.files.length > 0) {
                await this.uploadManager.addFiles(e.dataTransfer.files);
            }
        });

        // Prevent default drag behaviors on the upload tab
        if (this.elements.uploadTab) {
            this.elements.uploadTab.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            this.elements.uploadTab.addEventListener('drop', (e) => {
                e.preventDefault();
            });
        }
    }

    /**
     * Setup header and upload more files event listeners
     */
    setupHeaderEventListeners() {
        // Header upload icon click handler
        const headerUploadIcon = document.getElementById('headerUploadIcon');
        if (headerUploadIcon) {
            // Remove existing listeners to avoid duplicates
            headerUploadIcon.replaceWith(headerUploadIcon.cloneNode(true));
            const newHeaderIcon = document.getElementById('headerUploadIcon');
            newHeaderIcon.addEventListener('click', () => {
                this.openFileDialog();
            });
        }

        // Upload more files button click handler
        const uploadMoreFilesBtn = document.getElementById('uploadMoreFilesBtn');
        if (uploadMoreFilesBtn) {
            // Remove existing listeners to avoid duplicates
            uploadMoreFilesBtn.replaceWith(uploadMoreFilesBtn.cloneNode(true));
            const newUploadBtn = document.getElementById('uploadMoreFilesBtn');
            newUploadBtn.addEventListener('click', () => {
                this.openFileDialog();
            });
        }

        // Stop all uploads button click handler
        const stopAllUploadsBtn = document.getElementById('stopAllUploadsBtn');
        if (stopAllUploadsBtn) {
            // Remove existing listeners to avoid duplicates
            stopAllUploadsBtn.replaceWith(stopAllUploadsBtn.cloneNode(true));
            const newStopBtn = document.getElementById('stopAllUploadsBtn');
            newStopBtn.addEventListener('click', async () => {
                await this.stopAllUploads();
            });
        }

        // Clear history button click handler
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            // Remove existing listeners to avoid duplicates
            clearHistoryBtn.replaceWith(clearHistoryBtn.cloneNode(true));
            const newClearBtn = document.getElementById('clearHistoryBtn');
            newClearBtn.addEventListener('click', () => {
                this.clearUploadHistory();
            });
        }
    }

    /**
     * Show drop overlay with animation
     */
    showDropOverlay() {
        if (this.elements.dropOverlay) {
            this.isDragOver = true;
            this.elements.dropOverlay.classList.remove('hidden');
            // Trigger animation
            requestAnimationFrame(() => {
                this.elements.dropOverlay.style.opacity = '1';
            });
        }
    }

    /**
     * Hide drop overlay with animation
     */
    hideDropOverlay() {
        if (this.elements.dropOverlay && this.isDragOver) {
            this.isDragOver = false;
            this.elements.dropOverlay.style.opacity = '0';
            setTimeout(() => {
                this.elements.dropOverlay.classList.add('hidden');
            }, 200);
        }
    }

    /**
     * Switch between empty and queue states
     * @param {boolean} hasFiles - Whether there are files in the queue
     */
    switchMode(hasFiles) {
        if (hasFiles) {
            // Show queue state, hide empty state
            if (this.elements.emptyState) {
                this.elements.emptyState.classList.add('hidden');
            }
            if (this.elements.queueState) {
                this.elements.queueState.classList.remove('hidden');
            }
            // Setup header event listeners when switching to queue mode
            setTimeout(() => {
                this.setupHeaderEventListeners();
            }, 100);
        } else {
            // Show empty state, hide queue state
            if (this.elements.queueState) {
                this.elements.queueState.classList.add('hidden');
            }
            if (this.elements.emptyState) {
                this.elements.emptyState.classList.remove('hidden');
            }
        }
    }

    /**
     * Show the upload screen
     */
    async show() {
        if (this.elements.uploadTab) {
            this.elements.uploadTab.classList.remove('hidden');
            this.isVisible = true;
            
            // Update available services
            await this.updateAvailableServices();
            
            // Update UI with current queue state
            const stats = this.uploadManager.getQueueStats();
            this.updateQueueDisplay(stats);
            this.switchMode(stats.total > 0);
            
            // Setup header event listeners if in queue mode
            if (stats.total > 0) {
                this.setupHeaderEventListeners();
            }
        }
    }

    /**
     * Hide the upload screen
     */
    hide() {
        if (this.elements.uploadTab) {
            this.elements.uploadTab.classList.add('hidden');
            this.isVisible = false;
            this.hideDropOverlay();
        }
    }

    /**
     * Update queue display with current statistics
     * @param {Object} stats - Queue statistics
     */
    updateQueueDisplay(stats) {
        // Update stats counters
        const queuedCount = document.getElementById('queuedCount');
        const completedCount = document.getElementById('completedCount');
        const failedCount = document.getElementById('failedCount');

        // Queued includes both pending and uploading files
        const queued = stats.pending + stats.uploading;
        
        if (queuedCount) queuedCount.textContent = queued;
        if (completedCount) completedCount.textContent = stats.completed;
        if (failedCount) failedCount.textContent = stats.failed;

        // Switch between modes based on whether we have files
        this.switchMode(stats.total > 0);

        // Show/hide stop button based on whether there are active uploads
        this.updateStopButtonVisibility(stats);

        // Update active uploads display
        this.updateActiveUploadsDisplay();
    }

    /**
     * Update stop button and clear history button visibility based on upload status
     * @param {Object} stats - Queue statistics
     */
    updateStopButtonVisibility(stats) {
        const stopAllUploadsContainer = document.getElementById('stopAllUploadsContainer');
        const clearHistoryContainer = document.getElementById('clearHistoryContainer');
        
        // Show stop button if there are pending or uploading files
        const hasActiveUploads = stats.pending > 0 || stats.uploading > 0;
        
        if (stopAllUploadsContainer) {
            if (hasActiveUploads) {
                stopAllUploadsContainer.classList.remove('hidden');
            } else {
                stopAllUploadsContainer.classList.add('hidden');
            }
        }
        
        // Show clear history button if there are completed or failed uploads (but no active uploads)
        const hasCompletedUploads = stats.completed > 0 || stats.failed > 0;
        
        if (clearHistoryContainer) {
            if (hasCompletedUploads && !hasActiveUploads) {
                clearHistoryContainer.classList.remove('hidden');
            } else {
                clearHistoryContainer.classList.add('hidden');
            }
        }
    }

    /**
     * Update active uploads display
     */
    updateActiveUploadsDisplay() {
        const activeUploadsList = document.getElementById('activeUploadsList');
        if (!activeUploadsList) return;

        // Get all active uploads from the upload manager
        const activeUploads = this.uploadManager.getActiveUploads();
        
        // Clear existing progress bars
        activeUploadsList.innerHTML = '';

        // Create progress bar for each active upload
        activeUploads.forEach(fileItem => {
            const progressElement = this.createUploadProgressElement(fileItem);
            activeUploadsList.appendChild(progressElement);
        });

        // Show/hide the active uploads section
        const activeUploadsProgress = document.getElementById('activeUploadsProgress');
        if (activeUploadsProgress) {
            if (activeUploads.length > 0) {
                activeUploadsProgress.classList.remove('hidden');
            } else {
                activeUploadsProgress.classList.add('hidden');
            }
        }
    }

    /**
     * Create progress element for a single upload
     * @param {Object} fileItem - File item being uploaded
     * @returns {HTMLElement} Progress element
     */
    createUploadProgressElement(fileItem) {
        const progressElement = document.createElement('div');
        progressElement.className = 'bg-white border border-gray-200 rounded-lg p-4 shadow-sm';
        progressElement.id = `upload-progress-${fileItem.id}`;

        const uploadedBytes = Math.round((fileItem.progress / 100) * fileItem.size);
        const uploadedSize = this.formatFileSize(uploadedBytes);
        const totalSize = this.formatFileSize(fileItem.size);

        progressElement.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                    ${this.getFileIcon(fileItem.type)}
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-gray-900 truncate" title="${fileItem.name}">
                            ${fileItem.name}
                        </div>
                        <div class="text-xs text-gray-500">
                            ${uploadedSize} / ${totalSize}
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-2 ml-4">
                    <span class="text-sm font-medium text-gray-900">${Math.round(fileItem.progress)}%</span>
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${this.getStatusBadgeClass(fileItem.status)}">
                        ${fileItem.status}
                    </span>
                </div>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" style="width: ${fileItem.progress}%"></div>
            </div>
            ${fileItem.statusMessage ? `<div class="text-xs text-gray-500 mt-1">${fileItem.statusMessage}</div>` : ''}
        `;

        return progressElement;
    }

    /**
     * Update file progress in the UI
     * @param {Object} fileItem - File item with progress
     */
    updateFileProgress(fileItem) {
        // Update the specific progress element for this file
        const progressElement = document.getElementById(`upload-progress-${fileItem.id}`);
        if (progressElement && fileItem.status === 'uploading') {
            // Update the progress bar
            const progressBar = progressElement.querySelector('.bg-blue-600');
            if (progressBar) {
                progressBar.style.width = `${fileItem.progress}%`;
            }

            // Update the percentage text
            const percentageText = progressElement.querySelector('.text-sm.font-medium.text-gray-900');
            if (percentageText) {
                percentageText.textContent = `${Math.round(fileItem.progress)}%`;
            }

            // Update the uploaded bytes
            const uploadedBytes = Math.round((fileItem.progress / 100) * fileItem.size);
            const uploadedSize = this.formatFileSize(uploadedBytes);
            const totalSize = this.formatFileSize(fileItem.size);
            const sizeText = progressElement.querySelector('.text-xs.text-gray-500');
            if (sizeText) {
                sizeText.textContent = `${uploadedSize} / ${totalSize}`;
            }

            // Update status message if present
            const statusMessageElement = progressElement.querySelector('.text-xs.text-gray-500.mt-1');
            if (fileItem.statusMessage) {
                if (statusMessageElement) {
                    statusMessageElement.textContent = fileItem.statusMessage;
                } else {
                    // Add status message if it doesn't exist
                    const statusDiv = document.createElement('div');
                    statusDiv.className = 'text-xs text-gray-500 mt-1';
                    statusDiv.textContent = fileItem.statusMessage;
                    progressElement.appendChild(statusDiv);
                }
            }
        } else {
            // Refresh the entire active uploads display
            this.updateActiveUploadsDisplay();
        }
    }

    /**
     * Get file icon based on file type
     * @param {string} fileType - MIME type of the file
     * @returns {string} HTML for file icon
     */
    getFileIcon(fileType) {
        if (fileType.startsWith('image/')) {
            return `<svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>`;
        } else if (fileType.startsWith('video/')) {
            return `<svg class="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>`;
        } else if (fileType.startsWith('audio/')) {
            return `<svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
            </svg>`;
        } else {
            return `<svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>`;
        }
    }

    /**
     * Get CSS classes for status badge
     * @param {string} status - File status
     * @returns {string} CSS classes
     */
    getStatusBadgeClass(status) {
        switch (status) {
            case 'pending':
                return 'bg-gray-100 text-gray-800';
            case 'uploading':
                return 'bg-blue-100 text-blue-800';
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'failed':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Clear the progress displays
     */
    clearProgressDisplays() {
        // Clear active uploads list
        const activeUploadsList = document.getElementById('activeUploadsList');
        if (activeUploadsList) {
            activeUploadsList.innerHTML = '';
        }
        
        // Hide active uploads section
        const activeUploadsProgress = document.getElementById('activeUploadsProgress');
        if (activeUploadsProgress) {
            activeUploadsProgress.classList.add('hidden');
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
     * Get upload area element (for backward compatibility)
     * @returns {HTMLElement} Upload area element
     */
    getUploadArea() {
        return this.elements.emptyState || this.elements.uploadTab;
    }

    /**
     * Enable/disable upload area
     * @param {boolean} enabled - Whether to enable the upload area
     */
    setUploadAreaEnabled(enabled) {
        const uploadArea = this.getUploadArea();
        if (uploadArea) {
            if (enabled) {
                uploadArea.classList.remove('opacity-50', 'cursor-not-allowed');
                uploadArea.classList.add('cursor-pointer');
            } else {
                uploadArea.classList.add('opacity-50', 'cursor-not-allowed');
                uploadArea.classList.remove('cursor-pointer');
            }
        }
    }

    /**
     * Stop all uploads
     */
    async stopAllUploads() {
        try {
            await this.uploadManager.stopAllUploads();
        } catch (error) {
            console.error('Failed to stop uploads:', error);
            UIComponents.Notification.show('Failed to stop uploads: ' + error.message, 'error');
        }
    }

    /**
     * Clear upload history and return to initial screen
     */
    clearUploadHistory() {
        try {
            // Clear the upload queue and history
            this.uploadManager.clearHistory();
            
            // Clear progress displays
            this.clearProgressDisplays();
            
            // Switch back to empty state
            this.switchMode(false);
            
            // Update available services to refresh the UI
            this.updateAvailableServices();
            
            UIComponents.Notification.show('Upload history cleared.', 'info');
        } catch (error) {
            console.error('Failed to clear upload history:', error);
            UIComponents.Notification.show('Failed to clear upload history: ' + error.message, 'error');
        }
    }

    /**
     * Cleanup resources when screen is destroyed
     */
    destroy() {
        if (this.fileInput) {
            this.fileInput.remove();
            this.fileInput = null;
        }
        
        if (this.elements.dropOverlay) {
            this.elements.dropOverlay.remove();
            this.elements.dropOverlay = null;
        }
        
        this.isVisible = false;
        this.isDragOver = false;
    }

    /**
     * Update available services based on authentication and configuration
     */
    async updateAvailableServices() {
        this.availableServices = [];
        
        try {
            // Get service preferences from localStorage
            const preferences = this.getServicePreferences();
            
            // Add authentication info for ZenTransfer
            const tokenResult = await TokenManager.ensureValidToken();
            if (tokenResult.valid) {
                preferences.token = tokenResult.token;
                preferences.apiBaseUrl = config.SERVER_BASE_URL;
                preferences.appName = config.APP_NAME;
                preferences.appVersion = config.APP_VERSION;
                preferences.clientId = config.CLIENT_ID;
            }
            
            // Create services from preferences in main process
            const services = await uploadServiceFactory.createServicesFromPreferences(preferences);
            
            // Convert service info to available services format
            for (const serviceInfo of services) {
                const displayInfo = await uploadServiceFactory.getServiceDisplayInfo(serviceInfo.type);
                this.availableServices.push({
                    type: serviceInfo.type,
                    name: displayInfo.name,
                    description: displayInfo.description,
                    icon: displayInfo.icon,
                    color: displayInfo.color,
                    configured: serviceInfo.configured
                });
            }
            
            // Set default service if current selection is not available
            if (this.availableServices.length > 0) {
                const currentServiceAvailable = this.availableServices.some(s => s.type === this.selectedService);
                if (!currentServiceAvailable) {
                    this.selectedService = this.availableServices[0].type;
                }
            } else {
                this.selectedService = null;
            }
            
            // Update UI
            this.updateServiceSelectionUI();
            this.updateUploadButtonState();
            
        } catch (error) {
            console.error('Failed to update available services:', error);
            this.availableServices = [];
            this.selectedService = null;
            this.updateServiceSelectionUI();
            this.updateUploadButtonState();
        }
    }

    /**
     * Get service preferences from localStorage
     * @returns {Object} Service preferences
     */
    getServicePreferences() {
        try {
            const preferences = localStorage.getItem('zentransfer_preferences');
            return preferences ? JSON.parse(preferences) : {};
        } catch (error) {
            console.error('Failed to load service preferences:', error);
            return {};
        }
    }

    /**
     * Update service selection UI in both states
     */
    updateServiceSelectionUI() {
        this.updateEmptyStateServiceSelection();
        this.updateQueueStateServiceSelection();
    }

    /**
     * Update upload button state based on available services
     */
    updateUploadButtonState() {
        const hasServices = this.availableServices.length > 0;
        
        // Update empty state
        const emptyState = this.elements.emptyState;
        if (emptyState) {
            if (hasServices) {
                emptyState.classList.remove('opacity-50', 'cursor-not-allowed');
                emptyState.classList.add('cursor-pointer');
            } else {
                emptyState.classList.add('opacity-50', 'cursor-not-allowed');
                emptyState.classList.remove('cursor-pointer');
            }
        }
        
        // Update queue state buttons
        const uploadMoreBtn = document.getElementById('uploadMoreFilesBtn');
        const headerUploadIcon = document.getElementById('headerUploadIcon');
        
        if (uploadMoreBtn) {
            uploadMoreBtn.disabled = !hasServices;
            if (hasServices) {
                uploadMoreBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                uploadMoreBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
        
        if (headerUploadIcon) {
            if (hasServices) {
                headerUploadIcon.classList.remove('opacity-50', 'cursor-not-allowed');
                headerUploadIcon.classList.add('cursor-pointer');
            } else {
                headerUploadIcon.classList.add('opacity-50', 'cursor-not-allowed');
                headerUploadIcon.classList.remove('cursor-pointer');
            }
        }
    }

    /**
     * Update service selection in empty state
     */
    updateEmptyStateServiceSelection() {
        const serviceSelector = document.getElementById('emptyStateServiceSelector');
        if (serviceSelector) {
            serviceSelector.innerHTML = this.createServiceSelectorHTML();
            this.setupServiceSelectorEvents('emptyStateServiceSelector');
        }
    }

    /**
     * Update service selection in queue state
     */
    updateQueueStateServiceSelection() {
        const serviceSelector = document.getElementById('queueStateServiceSelector');
        if (serviceSelector) {
            serviceSelector.innerHTML = this.createServiceSelectorHTML();
            this.setupServiceSelectorEvents('queueStateServiceSelector');
        }
    }

    /**
     * Create service selector HTML
     */
    createServiceSelectorHTML() {
        if (this.availableServices.length === 0) {
            return `
                <div class="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div class="text-gray-900 font-medium mb-2">No Upload Services Available</div>
                    <div class="text-sm text-gray-800 mb-3">
                        Please configure cloud storage services in Settings.
                    </div>
                </div>
            `;
        }
        
        const options = this.availableServices.map(service => `
            <option value="${service.type}" ${service.type === this.selectedService ? 'selected' : ''}>
                ${service.icon} ${service.name}
            </option>
        `).join('');
        
        return `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Upload to:</label>
                <select class="service-selector w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    ${options}
                </select>
            </div>
        `;
    }

    /**
     * Setup service selector event listeners
     */
    setupServiceSelectorEvents(selectorId) {
        const container = document.getElementById(selectorId);
        if (container) {
            const select = container.querySelector('.service-selector');
            if (select) {
                select.addEventListener('change', (e) => {
                    this.selectedService = e.target.value;
                    this.updateServiceSelectionUI();
                    
                    // Notify upload manager of service change
                    if (this.uploadManager) {
                        this.uploadManager.setSelectedService(this.selectedService);
                    }
                    
                    console.log('Selected service changed to:', this.selectedService);
                });
            }
        }
    }
} 