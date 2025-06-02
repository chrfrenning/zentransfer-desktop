/**
 * Import Screen
 * Handles file import functionality from SD cards and devices with backup and upload options
 */

import { UIComponents } from '../components/ui-components.js';
import { config } from '../config/app-config.js';
import { StorageManager } from '../components/storage-manager.js';
import { ImportManager } from '../import/import-manager.js';
import { TokenManager } from '../auth/token-manager.js';

export class ImportScreen {
    constructor(uploadManager) {
        this.uploadManager = uploadManager;
        this.isVisible = false;
        this.elements = {};
        this.isImporting = false;
        this.importProgress = {
            total: 0,
            completed: 0,
            failed: 0,
            current: null,
            uploadQueued: 0
        };
        this.importLogEntries = []; // Store log entries for persistence
        
        // Initialize import manager
        this.importManager = new ImportManager(uploadManager);
        this.setupImportCallbacks();
        
        this.initializeElements();
        this.setupEventListeners();
    }

    /**
     * Setup import manager callbacks
     */
    setupImportCallbacks() {
        this.importManager.setCallbacks({
            onProgress: (progress) => this.handleImportProgress(progress),
            onLog: (message) => this.addLogEntry(message),
            onCompleted: (data) => this.handleImportCompleted(data),
            onError: (data) => this.handleImportError(data),
            onCancelled: (data) => this.handleImportCancelled(data)
        });
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            importTab: document.getElementById('importTab')
        };

        // Create the new import UI
        this.createImportUI();
    }

    /**
     * Create import UI with setup and progress modes
     */
    createImportUI() {
        if (!this.elements.importTab) return;

        // Clear existing content and remove constraining classes
        this.elements.importTab.innerHTML = '';
        this.elements.importTab.className = 'h-full px-4 pt-2 pb-6 overflow-y-auto';

        // Create setup mode (shown when not importing)
        this.createSetupMode();
        
        // Create progress mode (shown when importing)
        this.createProgressMode();
    }

    /**
     * Create setup mode UI
     */
    createSetupMode() {
        const setupMode = document.createElement('div');
        setupMode.id = 'importSetupMode';
        setupMode.className = 'w-full';
        
        setupMode.innerHTML = `
            <!-- Compact Header -->
            <div class="flex items-center mt-2 mb-6 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="flex-shrink-0 mr-6">
                    <div class="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-md">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <h2 class="text-lg font-semibold text-gray-900 leading-tight">Import</h2>
                    <p class="text-sm text-gray-600 leading-tight">Import from SD-Card</p>
                </div>
            </div>

            <!-- Settings -->
            <div class="max-w-2xl space-y-6">
                    <!-- Import From -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Import from <span class="text-red-500">*</span></label>
                        <div class="flex space-x-2">
                            <input 
                                type="text" 
                                id="importFromInput" 
                                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm" 
                                placeholder="Select source directory (e.g., SD card)..."
                                readonly
                            >
                            <button 
                                id="browseImportBtn" 
                                class="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-purple-500 text-sm"
                                title="Select source directory"
                            >
                                Browse
                            </button>
                        </div>
                        <!-- Include Subdirectories -->
                        <div class="flex items-center space-x-3 mt-2">
                            <input 
                                type="checkbox" 
                                id="includeSubdirectoriesCheckbox" 
                                class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                                checked
                            >
                            <label for="includeSubdirectoriesCheckbox" class="text-sm text-gray-700">Include subfolders</label>
                        </div>
                    </div>

                    <!-- Destination (Required) -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Destination <span class="text-red-500">*</span></label>
                        <div class="flex space-x-2">
                            <input 
                                type="text" 
                                id="destinationInput" 
                                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm" 
                                placeholder="Select destination directory..."
                                readonly
                            >
                            <button 
                                id="browseDestinationBtn" 
                                class="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-purple-500 text-sm"
                                title="Select destination directory"
                            >
                                Browse
                            </button>
                        </div>
                        
                        <!-- Organize into folders -->
                        <div class="mt-3">
                            <div class="flex items-center space-x-3 mb-2">
                                <input 
                                    type="checkbox" 
                                    id="organizeIntoFoldersCheckbox" 
                                    class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                                >
                                <label for="organizeIntoFoldersCheckbox" class="text-sm font-medium text-gray-700">Organize into folders</label>
                            </div>
                            
                            <div id="folderOrganizationContainer" class="hidden ml-7 space-y-3">
                                <!-- Folder organization options -->
                                <div class="space-y-2">
                                    <div class="flex items-center space-x-3">
                                        <input 
                                            type="radio" 
                                            id="dateFolderRadio" 
                                            name="folderOrganization" 
                                            value="date"
                                            class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 focus:ring-purple-500 focus:ring-2"
                                            checked
                                        >
                                        <label for="dateFolderRadio" class="text-sm text-gray-700">Organize by date:</label>
                                    </div>
                                    <select 
                                        id="dateFormatSelect" 
                                        class="w-[calc(100%-8rem)] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm ml-7"
                                    >
                                        <option value="2025/05/26" selected>2025/05/26 (YYYY/MM/DD)</option>
                                        <option value="2025-05-26">2025-05-26 (YYYY-MM-DD)</option>
                                        <option value="2025/2025-05-26">2025/2025-05-26</option>
                                        <option value="2025/may 26">2025/may 26</option>
                                        <option value="2025/05">2025/05 (YYYY/MM)</option>
                                        <option value="2025/may">2025/may</option>
                                        <option value="2025/may/26">2025/may/26</option>
                                        <option value="2025/2025-05/2025-05-26">2025/2025-05/2025-05-26</option>
                                        <option value="2025 may 26">2025 may 26</option>
                                        <option value="20250526">20250526 (YYYYMMDD)</option>
                                    </select>
                                </div>
                                
                                <div class="space-y-2">
                                    <div class="flex items-center space-x-3">
                                        <input 
                                            type="radio" 
                                            id="customFolderRadio" 
                                            name="folderOrganization" 
                                            value="custom"
                                            class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 focus:ring-purple-500 focus:ring-2"
                                        >
                                        <label for="customFolderRadio" class="text-sm text-gray-700">Custom folder name:</label>
                                    </div>
                                    <input 
                                        type="text" 
                                        id="customFolderNameInput" 
                                        class="w-[calc(100%-8rem)] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm ml-7" 
                                        placeholder="Enter folder name..."
                                        disabled
                                    >
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Backup Option -->
                    <div>
                        <div class="flex items-center space-x-3 mb-2">
                            <input 
                                type="checkbox" 
                                id="enableBackupCheckbox" 
                                class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                            >
                            <label for="enableBackupCheckbox" class="text-sm font-medium text-gray-700">Create backup copy</label>
                        </div>
                        <div id="backupPathContainer" class="hidden">
                            <div class="flex space-x-2">
                                <input 
                                    type="text" 
                                    id="backupPathInput" 
                                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm" 
                                    placeholder="Select backup directory..."
                                    readonly
                                >
                                <button 
                                    id="browseBackupBtn" 
                                    class="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-purple-500 text-sm"
                                    title="Select backup directory"
                                >
                                    Browse
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Upload Options -->
                    <div>
                        <div class="flex items-center space-x-3 mb-3">
                            <input 
                                type="checkbox" 
                                id="enableCloudUploadCheckbox" 
                                class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                            >
                            <label for="enableCloudUploadCheckbox" class="text-sm font-medium text-gray-700 cursor-pointer">Upload to cloud</label>
                        </div>
                        
                        <div id="cloudServicesContainer" class="hidden ml-7 space-y-3">
                            
                            <!-- Upload to AWS S3 -->
                            <div class="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="uploadToAwsS3Checkbox" 
                                    class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                <label for="uploadToAwsS3Checkbox" class="text-sm font-medium text-gray-700 cursor-pointer">
                                    ☁️ Upload to AWS S3
                                </label>
                            </div>
                            
                            <!-- Upload to Azure Blob Storage -->
                            <div class="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="uploadToAzureCheckbox" 
                                    class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                <label for="uploadToAzureCheckbox" class="text-sm font-medium text-gray-700 cursor-pointer">
                                    ☁️ Upload to Azure Blob Storage
                                </label>
                            </div>
                            
                            <!-- Upload to Google Cloud Storage -->
                            <div class="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="uploadToGcpCheckbox" 
                                    class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                <label for="uploadToGcpCheckbox" class="text-sm font-medium text-gray-700 cursor-pointer">
                                    ☁️ Upload to GCP Bucket
                                </label>
                            </div>

                            <!-- Upload to ZenTransfer -->
                            <div class="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="uploadToZenTransferCheckbox" 
                                    class="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                <label for="uploadToZenTransferCheckbox" class="text-sm font-medium text-gray-700 cursor-pointer">
                                    🚀 Relay with ZenTransfer.io
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Start Import Button -->
                    <button 
                        id="startImportBtn" 
                        class="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled
                    >
                        Start Import
                    </button>
                </div>
        `;

        this.elements.importTab.appendChild(setupMode);
        this.elements.setupMode = setupMode;
    }

    /**
     * Create progress mode UI
     */
    createProgressMode() {
        const progressMode = document.createElement('div');
        progressMode.id = 'importProgressMode';
        progressMode.className = 'hidden w-full h-full flex flex-col';
        
        progressMode.innerHTML = `
            <!-- Compact Header with status and stop button -->
            <div class="flex items-center justify-between mt-2 mb-6 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0 mr-3">
                        <div class="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-md">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2">
                            <h2 class="text-lg font-semibold text-gray-900 leading-tight">Import</h2>
                            <div class="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        </div>
                        <p class="text-sm text-purple-600 leading-tight">Import in progress</p>
                    </div>
                </div>
                <button 
                    id="stopImportBtn" 
                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 font-medium text-sm"
                >
                    Stop
                </button>
            </div>

            <!-- Overall Progress -->
            <div class="mb-6">
                <div class="flex justify-between text-sm text-gray-600 mb-3">
                    <span class="font-medium">Overall Progress</span>
                    <span id="overallProgressText">0%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-4">
                    <div id="overallProgressBar" class="bg-purple-600 h-4 rounded-full transition-all duration-500 ease-out" style="width: 0%"></div>
                </div>
            </div>

            <!-- Current File Progress -->
            <div id="currentFileProgress" class="mb-6">
                <div class="flex justify-between items-center text-sm text-gray-600 mb-3">
                    <span class="font-medium truncate" id="currentFileName">Preparing...</span>
                    <span id="currentFileProgressText" class="ml-4">0%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3">
                    <div id="currentFileProgressBar" class="bg-green-600 h-3 rounded-full transition-all duration-300 ease-out" style="width: 0%"></div>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="flex w-full gap-4 mb-6">
                <div class="flex-1 text-center p-4 bg-blue-50 rounded-lg">
                    <div class="font-semibold text-2xl text-blue-600" id="totalFilesCount">0</div>
                    <div class="text-sm text-gray-600">Total</div>
                </div>
                <div class="flex-1 text-center p-4 bg-green-50 rounded-lg">
                    <div class="font-semibold text-2xl text-green-600" id="completedFilesCount">0</div>
                    <div class="text-sm text-gray-600">Completed</div>
                </div>
                <div class="flex-1 text-center p-4 bg-red-50 rounded-lg">
                    <div class="font-semibold text-2xl text-red-600" id="failedFilesCount">0</div>
                    <div class="text-sm text-gray-600">Failed</div>
                </div>
            </div>

            <!-- Import Log -->
            <div class="flex-1 bg-white rounded-lg border overflow-hidden">
                <div class="p-4 border-b bg-gray-50">
                    <h3 class="text-sm font-medium text-gray-900">Import Log</h3>
                </div>
                <div id="importLogContainer" class="flex-1 overflow-y-auto max-h-64">
                    <div id="importLog" class="p-4 text-sm text-gray-600 space-y-1">
                        <!-- Log entries will be added here -->
                    </div>
                </div>
            </div>
        `;

        this.elements.importTab.appendChild(progressMode);
        this.elements.progressMode = progressMode;
    }

    /**
     * Setup event listeners for import screen
     */
    setupEventListeners() {
        // Cache elements first
        this.cacheElements();
        
        // Browse buttons
        if (this.elements.browseImportBtn) {
            this.elements.browseImportBtn.addEventListener('click', () => {
                this.browseDirectory('import');
            });
        }

        if (this.elements.browseDestinationBtn) {
            this.elements.browseDestinationBtn.addEventListener('click', () => {
                this.browseDirectory('destination');
            });
        }

        if (this.elements.browseBackupBtn) {
            this.elements.browseBackupBtn.addEventListener('click', () => {
                this.browseDirectory('backup');
            });
        }

        // Organize into folders checkbox
        if (this.elements.organizeIntoFoldersCheckbox) {
            this.elements.organizeIntoFoldersCheckbox.addEventListener('change', () => {
                this.toggleFolderOrganization();
                this.saveAllSettings();
            });
        }

        // Folder organization radio buttons
        if (this.elements.customFolderRadio) {
            this.elements.customFolderRadio.addEventListener('change', () => {
                this.updateFolderOrganizationInputs();
                this.saveAllSettings();
            });
        }

        if (this.elements.dateFolderRadio) {
            this.elements.dateFolderRadio.addEventListener('change', () => {
                this.updateFolderOrganizationInputs();
                this.saveAllSettings();
            });
        }

        // Backup checkbox
        if (this.elements.enableBackupCheckbox) {
            this.elements.enableBackupCheckbox.addEventListener('change', () => {
                this.toggleBackupPath();
                this.saveAllSettings();
            });
        }

        // Start import button
        if (this.elements.startImportBtn) {
            this.elements.startImportBtn.addEventListener('click', () => {
                this.startImport();
            });
        }

        // Stop import button
        if (this.elements.stopImportBtn) {
            this.elements.stopImportBtn.addEventListener('click', () => {
                this.stopImport();
            });
        }

        // Input change listeners for validation and persistence
        ['importFromInput', 'destinationInput', 'customFolderNameInput'].forEach(inputId => {
            const input = this.elements[inputId];
            if (input) {
                input.addEventListener('input', () => {
                    this.validateInputs();
                    this.saveAllSettings();
                });
            }
        });

        // Date format change listener
        if (this.elements.dateFormatSelect) {
            this.elements.dateFormatSelect.addEventListener('change', () => {
                this.saveAllSettings();
            });
        }

        // Include subdirectories change listener
        if (this.elements.includeSubdirectoriesCheckbox) {
            this.elements.includeSubdirectoriesCheckbox.addEventListener('change', () => {
                this.saveAllSettings();
            });
        }

        // Upload service change listeners
        if (this.elements.uploadToZenTransferCheckbox) {
            this.elements.uploadToZenTransferCheckbox.addEventListener('change', () => {
                this.saveAllSettings();
            });
        }

        if (this.elements.uploadToAwsS3Checkbox) {
            this.elements.uploadToAwsS3Checkbox.addEventListener('change', () => {
                this.saveAllSettings();
            });
        }

        if (this.elements.uploadToAzureCheckbox) {
            this.elements.uploadToAzureCheckbox.addEventListener('change', () => {
                this.saveAllSettings();
            });
        }

        if (this.elements.uploadToGcpCheckbox) {
            this.elements.uploadToGcpCheckbox.addEventListener('change', () => {
                this.saveAllSettings();
            });
        }

        // Enable cloud upload checkbox
        if (this.elements.enableCloudUploadCheckbox) {
            this.elements.enableCloudUploadCheckbox.addEventListener('change', () => {
                this.toggleCloudServices();
                this.saveAllSettings();
            });
        }
    }

    /**
     * Cache DOM element references
     */
    cacheElements() {
        // Setup mode elements
        this.elements.importFromInput = document.getElementById('importFromInput');
        this.elements.browseImportBtn = document.getElementById('browseImportBtn');
        this.elements.includeSubdirectoriesCheckbox = document.getElementById('includeSubdirectoriesCheckbox');
        this.elements.destinationInput = document.getElementById('destinationInput');
        this.elements.browseDestinationBtn = document.getElementById('browseDestinationBtn');
        this.elements.organizeIntoFoldersCheckbox = document.getElementById('organizeIntoFoldersCheckbox');
        this.elements.folderOrganizationContainer = document.getElementById('folderOrganizationContainer');
        this.elements.customFolderRadio = document.getElementById('customFolderRadio');
        this.elements.dateFolderRadio = document.getElementById('dateFolderRadio');
        this.elements.customFolderNameInput = document.getElementById('customFolderNameInput');
        this.elements.dateFormatSelect = document.getElementById('dateFormatSelect');
        this.elements.enableBackupCheckbox = document.getElementById('enableBackupCheckbox');
        this.elements.backupPathContainer = document.getElementById('backupPathContainer');
        this.elements.backupPathInput = document.getElementById('backupPathInput');
        this.elements.browseBackupBtn = document.getElementById('browseBackupBtn');
        this.elements.uploadToZenTransferCheckbox = document.getElementById('uploadToZenTransferCheckbox');
        this.elements.uploadToAwsS3Checkbox = document.getElementById('uploadToAwsS3Checkbox');
        this.elements.uploadToAzureCheckbox = document.getElementById('uploadToAzureCheckbox');
        this.elements.uploadToGcpCheckbox = document.getElementById('uploadToGcpCheckbox');
        this.elements.startImportBtn = document.getElementById('startImportBtn');
        
        // Progress mode elements
        this.elements.stopImportBtn = document.getElementById('stopImportBtn');
        this.elements.overallProgressBar = document.getElementById('overallProgressBar');
        this.elements.overallProgressText = document.getElementById('overallProgressText');
        this.elements.currentFileName = document.getElementById('currentFileName');
        this.elements.currentFileProgressBar = document.getElementById('currentFileProgressBar');
        this.elements.currentFileProgressText = document.getElementById('currentFileProgressText');
        this.elements.totalFilesCount = document.getElementById('totalFilesCount');
        this.elements.completedFilesCount = document.getElementById('completedFilesCount');
        this.elements.failedFilesCount = document.getElementById('failedFilesCount');
        this.elements.importLog = document.getElementById('importLog');
        
        // Enable cloud upload checkbox
        this.elements.enableCloudUploadCheckbox = document.getElementById('enableCloudUploadCheckbox');
        this.elements.cloudServicesContainer = document.getElementById('cloudServicesContainer');
    }

    /**
     * Load settings from storage
     */
    loadSettings() {
        // Load saved paths and settings
        const importPath = StorageManager.getImportPath();
        const destinationPath = StorageManager.getImportDestinationPath();
        const backupPath = StorageManager.getImportBackupPath();
        const enableBackup = StorageManager.getImportBackupEnabled();
        const uploadToZenTransfer = StorageManager.getImportUploadEnabled();
        const includeSubdirectories = StorageManager.getImportIncludeSubdirectories();
        const organizeIntoFolders = StorageManager.getImportOrganizeIntoFolders();
        const folderOrganizationType = StorageManager.getImportFolderOrganizationType();
        const customFolderName = StorageManager.getImportCustomFolderName();
        const dateFormat = StorageManager.getImportDateFormat();

        if (importPath && this.elements.importFromInput) {
            this.elements.importFromInput.value = importPath;
        }

        if (destinationPath && this.elements.destinationInput) {
            this.elements.destinationInput.value = destinationPath;
        }

        if (this.elements.includeSubdirectoriesCheckbox) {
            this.elements.includeSubdirectoriesCheckbox.checked = includeSubdirectories !== false; // Default to true
        }

        if (this.elements.organizeIntoFoldersCheckbox) {
            this.elements.organizeIntoFoldersCheckbox.checked = organizeIntoFolders !== false; // Default to true
            this.toggleFolderOrganization();
        }

        if (this.elements.customFolderRadio && this.elements.dateFolderRadio) {
            // Default to 'date' organization type
            if (folderOrganizationType === 'custom') {
                this.elements.customFolderRadio.checked = true;
                this.elements.dateFolderRadio.checked = false;
            } else {
                this.elements.dateFolderRadio.checked = true;
                this.elements.customFolderRadio.checked = false;
            }
            this.updateFolderOrganizationInputs();
        }

        if (customFolderName && this.elements.customFolderNameInput) {
            this.elements.customFolderNameInput.value = customFolderName;
        }

        if (this.elements.dateFormatSelect) {
            // Default to YYYY/MM/DD format
            this.elements.dateFormatSelect.value = dateFormat || '2025/05/26';
        }

        if (this.elements.enableBackupCheckbox) {
            this.elements.enableBackupCheckbox.checked = enableBackup || false;
            this.toggleBackupPath();
        }

        if (backupPath && this.elements.backupPathInput) {
            this.elements.backupPathInput.value = backupPath;
        }

        if (this.elements.uploadToZenTransferCheckbox) {
            this.elements.uploadToZenTransferCheckbox.checked = uploadToZenTransfer || false;
        }

        // Load cloud storage upload settings
        const uploadToAwsS3 = StorageManager.getImportUploadToAwsS3();
        const uploadToAzure = StorageManager.getImportUploadToAzure();
        const uploadToGcp = StorageManager.getImportUploadToGcp();

        if (this.elements.uploadToAwsS3Checkbox) {
            this.elements.uploadToAwsS3Checkbox.checked = uploadToAwsS3 || false;
        }

        if (this.elements.uploadToAzureCheckbox) {
            this.elements.uploadToAzureCheckbox.checked = uploadToAzure || false;
        }

        if (this.elements.uploadToGcpCheckbox) {
            this.elements.uploadToGcpCheckbox.checked = uploadToGcp || false;
        }

        // Load enable cloud upload setting
        const enableCloudUpload = StorageManager.getImportEnableCloudUpload();
        if (this.elements.enableCloudUploadCheckbox) {
            this.elements.enableCloudUploadCheckbox.checked = enableCloudUpload || false;
            this.toggleCloudServices();
        }

        // Update service availability after loading settings
        this.updateServiceAvailability();
        
        this.validateInputs();
    }

    /**
     * Check if a cloud service is configured and enabled
     * @param {string} serviceType - Service type to check
     * @returns {boolean} True if service is configured and enabled
     */
    isServiceConfigured(serviceType) {
        try {
            const preferences = localStorage.getItem('zentransfer_preferences');
            const prefs = preferences ? JSON.parse(preferences) : {};
            
            switch (serviceType) {
                case 'aws-s3':
                    return !!(prefs.awsS3Enabled && prefs.awsS3Region && prefs.awsS3Bucket && 
                             prefs.awsS3AccessKey && prefs.awsS3SecretKey);
                case 'azure-blob':
                    return !!(prefs.azureEnabled && prefs.azureConnectionString && prefs.azureContainer);
                case 'gcp-storage':
                    return !!(prefs.gcpEnabled && prefs.gcpBucket && prefs.gcpServiceAccountKey);
                case 'zentransfer':
                    // ZenTransfer requires authentication (no enable toggle needed)
                    return TokenManager.isAuthenticated();
                default:
                    return false;
            }
        } catch (error) {
            console.error('Failed to check service configuration:', error);
            return false;
        }
    }

    /**
     * Update service availability based on configuration and authentication
     */
    async updateServiceAvailability() {
        // Check ZenTransfer authentication
        const isZenTransferAvailable = await this.checkZenTransferAvailability();
        
        // Check cloud service configurations
        const isAwsS3Available = this.isServiceConfigured('aws-s3');
        const isAzureAvailable = this.isServiceConfigured('azure-blob');
        const isGcpAvailable = this.isServiceConfigured('gcp-storage');
        
        // Update UI elements
        this.updateServiceUI('zentransfer', isZenTransferAvailable, 'Please log in to enable ZenTransfer uploads');
        this.updateServiceUI('aws-s3', isAwsS3Available, 'Please enable and configure AWS S3 in Settings to enable uploads');
        this.updateServiceUI('azure-blob', isAzureAvailable, 'Please enable and configure Azure Blob Storage in Settings to enable uploads');
        this.updateServiceUI('gcp-storage', isGcpAvailable, 'Please enable and configure Google Cloud Storage in Settings to enable uploads');
    }

    /**
     * Check if ZenTransfer is available (user is authenticated)
     * @returns {Promise<boolean>} True if ZenTransfer is available
     */
    async checkZenTransferAvailability() {
        try {
            const tokenResult = await TokenManager.ensureValidToken();
            return tokenResult.valid;
        } catch (error) {
            console.log('ZenTransfer authentication check failed:', error);
            return false;
        }
    }

    /**
     * Update service UI based on availability
     * @param {string} serviceType - Service type
     * @param {boolean} isAvailable - Whether service is available
     * @param {string} disabledMessage - Message to show when disabled
     */
    updateServiceUI(serviceType, isAvailable, disabledMessage) {
        let checkbox, label;
        
        switch (serviceType) {
            case 'zentransfer':
                checkbox = this.elements.uploadToZenTransferCheckbox;
                label = checkbox?.parentElement;
                break;
            case 'aws-s3':
                checkbox = this.elements.uploadToAwsS3Checkbox;
                label = checkbox?.parentElement;
                break;
            case 'azure-blob':
                checkbox = this.elements.uploadToAzureCheckbox;
                label = checkbox?.parentElement;
                break;
            case 'gcp-storage':
                checkbox = this.elements.uploadToGcpCheckbox;
                label = checkbox?.parentElement;
                break;
        }
        
        if (checkbox && label) {
            checkbox.disabled = !isAvailable;
            
            if (isAvailable) {
                // Service is available
                label.classList.remove('opacity-50', 'cursor-not-allowed');
                label.classList.add('cursor-pointer');
                checkbox.title = '';
            } else {
                // Service is not available
                label.classList.add('opacity-50', 'cursor-not-allowed');
                label.classList.remove('cursor-pointer');
                checkbox.title = disabledMessage;
                checkbox.checked = false; // Uncheck if disabled
            }
        }
    }

    /**
     * Save all current settings to storage
     */
    saveAllSettings() {
        // Save all current form values to storage
        if (this.elements.includeSubdirectoriesCheckbox) {
            StorageManager.setImportIncludeSubdirectories(this.elements.includeSubdirectoriesCheckbox.checked);
        }

        if (this.elements.organizeIntoFoldersCheckbox) {
            StorageManager.setImportOrganizeIntoFolders(this.elements.organizeIntoFoldersCheckbox.checked);
        }

        if (this.elements.customFolderRadio && this.elements.dateFolderRadio) {
            const folderOrganizationType = this.elements.dateFolderRadio.checked ? 'date' : 'custom';
            StorageManager.setImportFolderOrganizationType(folderOrganizationType);
        }

        if (this.elements.customFolderNameInput && this.elements.customFolderNameInput.value.trim()) {
            StorageManager.setImportCustomFolderName(this.elements.customFolderNameInput.value.trim());
        }

        if (this.elements.dateFormatSelect) {
            StorageManager.setImportDateFormat(this.elements.dateFormatSelect.value);
        }

        if (this.elements.enableBackupCheckbox) {
            StorageManager.setImportBackupEnabled(this.elements.enableBackupCheckbox.checked);
        }

        if (this.elements.uploadToZenTransferCheckbox) {
            StorageManager.setImportUploadEnabled(this.elements.uploadToZenTransferCheckbox.checked);
        }

        // Save cloud storage upload settings
        if (this.elements.uploadToAwsS3Checkbox) {
            StorageManager.setImportUploadToAwsS3(this.elements.uploadToAwsS3Checkbox.checked);
        }

        if (this.elements.uploadToAzureCheckbox) {
            StorageManager.setImportUploadToAzure(this.elements.uploadToAzureCheckbox.checked);
        }

        if (this.elements.uploadToGcpCheckbox) {
            StorageManager.setImportUploadToGcp(this.elements.uploadToGcpCheckbox.checked);
        }

        // Save enable cloud upload setting
        if (this.elements.enableCloudUploadCheckbox) {
            StorageManager.setImportEnableCloudUpload(this.elements.enableCloudUploadCheckbox.checked);
        }
    }

    /**
     * Browse for directory
     * @param {string} type - Type of directory (import, destination, backup)
     */
    async browseDirectory(type) {
        try {
            let selectedPath = null;
            let userCancelled = false;

            // Check if we're in Electron environment
            if (typeof require !== 'undefined') {
                try {
                    const { ipcRenderer } = require('electron');
                    selectedPath = await ipcRenderer.invoke('show-directory-dialog');
                    
                    // If no path returned, user cancelled
                    if (!selectedPath) {
                        userCancelled = true;
                    }
                } catch (error) {
                    console.log('IPC not available, trying direct access');
                    
                    const currentPath = this.getCurrentPath(type);
                    const path = prompt(`Enter ${type} directory path:`, currentPath || '');
                    
                    // If user cancelled prompt (null) or entered empty string, don't proceed
                    if (path === null) {
                        userCancelled = true;
                    } else if (path && path.trim()) {
                        const trimmedPath = path.trim();
                        try {
                            const fs = require('fs');
                            if (fs.existsSync(trimmedPath)) {
                                selectedPath = trimmedPath;
                            } else {
                                UIComponents.Notification.show('Directory does not exist: ' + trimmedPath, 'error');
                                return;
                            }
                        } catch (fsError) {
                            console.error('File system access error:', fsError);
                            UIComponents.Notification.show('Failed to access directory', 'error');
                            return;
                        }
                    } else {
                        // Empty string entered
                        userCancelled = true;
                    }
                }
            }

            // Check if File System Access API is available (modern browsers)
            if (!selectedPath && !userCancelled && 'showDirectoryPicker' in window) {
                try {
                    const directoryHandle = await window.showDirectoryPicker();
                    selectedPath = directoryHandle.name;
                } catch (err) {
                    if (err.name === 'AbortError') {
                        // User cancelled the dialog
                        userCancelled = true;
                    } else {
                        console.error('Directory picker failed:', err);
                        UIComponents.Notification.show('Failed to open directory picker', 'error');
                        return;
                    }
                }
            }

            // Fallback for browsers without directory picker
            if (!selectedPath && !userCancelled) {
                const path = prompt(`Enter ${type} directory path:`);
                
                // If user cancelled prompt (null), don't proceed
                if (path === null) {
                    userCancelled = true;
                } else if (path && path.trim()) {
                    selectedPath = path.trim();
                } else {
                    // Empty string entered
                    userCancelled = true;
                }
            }

            // Only update the path if user didn't cancel and we have a valid path
            if (!userCancelled && selectedPath) {
                this.setPath(type, selectedPath);
                this.savePath(type, selectedPath);
                this.validateInputs();
                this.saveAllSettings();
                UIComponents.Notification.show(`${type.charAt(0).toUpperCase() + type.slice(1)} directory selected: ${selectedPath}`, 'success');
            }
            // If user cancelled, do nothing - keep existing path value

        } catch (error) {
            console.error('Failed to browse directory:', error);
            UIComponents.Notification.show(`Failed to select ${type} directory`, 'error');
        }
    }

    /**
     * Get current path for type
     * @param {string} type - Path type
     * @returns {string} Current path
     */
    getCurrentPath(type) {
        switch (type) {
            case 'import': return this.elements.importFromInput?.value || '';
            case 'destination': return this.elements.destinationInput?.value || '';
            case 'backup': return this.elements.backupPathInput?.value || '';
            default: return '';
        }
    }

    /**
     * Set path for type
     * @param {string} type - Path type
     * @param {string} path - Path value
     */
    setPath(type, path) {
        switch (type) {
            case 'import':
                if (this.elements.importFromInput) this.elements.importFromInput.value = path;
                break;
            case 'destination':
                if (this.elements.destinationInput) this.elements.destinationInput.value = path;
                break;
            case 'backup':
                if (this.elements.backupPathInput) this.elements.backupPathInput.value = path;
                break;
        }
    }

    /**
     * Save path to storage
     * @param {string} type - Path type
     * @param {string} path - Path value
     */
    savePath(type, path) {
        switch (type) {
            case 'import':
                StorageManager.setImportPath(path);
                break;
            case 'destination':
                StorageManager.setImportDestinationPath(path);
                break;
            case 'backup':
                StorageManager.setImportBackupPath(path);
                break;
        }
    }

    /**
     * Toggle backup path visibility
     */
    toggleBackupPath() {
        if (this.elements.backupPathContainer && this.elements.enableBackupCheckbox) {
            const isEnabled = this.elements.enableBackupCheckbox.checked;
            
            if (isEnabled) {
                this.elements.backupPathContainer.classList.remove('hidden');
            } else {
                this.elements.backupPathContainer.classList.add('hidden');
            }

            StorageManager.setImportBackupEnabled(isEnabled);
            this.validateInputs();
        }
    }

    /**
     * Toggle folder organization visibility
     */
    toggleFolderOrganization() {
        if (this.elements.folderOrganizationContainer && this.elements.organizeIntoFoldersCheckbox) {
            const isEnabled = this.elements.organizeIntoFoldersCheckbox.checked;
            
            if (isEnabled) {
                this.elements.folderOrganizationContainer.classList.remove('hidden');
            } else {
                this.elements.folderOrganizationContainer.classList.add('hidden');
            }

            this.updateFolderOrganizationInputs();
            this.validateInputs();
        }
    }

    /**
     * Update folder organization input states
     */
    updateFolderOrganizationInputs() {
        if (this.elements.customFolderNameInput && this.elements.dateFormatSelect && 
            this.elements.customFolderRadio && this.elements.dateFolderRadio) {
            
            const isCustomSelected = this.elements.customFolderRadio.checked;
            
            // Enable/disable inputs based on selection
            this.elements.customFolderNameInput.disabled = !isCustomSelected;
            this.elements.dateFormatSelect.disabled = isCustomSelected;
            
            this.validateInputs();
        }
    }

    /**
     * Validate inputs and update start button state
     */
    validateInputs() {
        if (!this.elements.startImportBtn) return;

        const hasImportPath = this.elements.importFromInput?.value.trim();
        const hasDestinationPath = this.elements.destinationInput?.value.trim();
        const backupEnabled = this.elements.enableBackupCheckbox?.checked;
        const hasBackupPath = this.elements.backupPathInput?.value.trim();
        const organizeEnabled = this.elements.organizeIntoFoldersCheckbox?.checked;
        const isCustomFolder = this.elements.customFolderRadio?.checked;
        const hasCustomFolderName = this.elements.customFolderNameInput?.value.trim();

        // Source and destination are mandatory
        let isValid = hasImportPath && hasDestinationPath;
        
        // If backup is enabled, backup path is required
        if (backupEnabled) {
            isValid = isValid && hasBackupPath;
        }

        // If folder organization is enabled and custom folder is selected, folder name is required
        if (organizeEnabled && isCustomFolder) {
            isValid = isValid && hasCustomFolderName;
        }

        this.elements.startImportBtn.disabled = !isValid;
    }

    /**
     * Switch between setup and progress modes
     * @param {boolean} isImporting - Whether import is active
     */
    switchMode(isImporting) {
        if (isImporting) {
            // Show progress mode, hide setup mode
            if (this.elements.setupMode) {
                this.elements.setupMode.classList.add('hidden');
            }
            if (this.elements.progressMode) {
                this.elements.progressMode.classList.remove('hidden');
            }
        } else {
            // Show setup mode, hide progress mode
            if (this.elements.progressMode) {
                this.elements.progressMode.classList.add('hidden');
            }
            if (this.elements.setupMode) {
                this.elements.setupMode.classList.remove('hidden');
            }
        }
    }

    /**
     * Show the import screen
     */
    show() {
        if (this.elements.importTab) {
            this.elements.importTab.classList.remove('hidden');
            this.isVisible = true;
            
            // Only load settings if not currently importing
            if (!this.isImporting) {
                this.loadSettings();
            } else {
                // Even if importing, update service availability in case auth state changed
                this.updateServiceAvailability();
            }
            
            // Switch to appropriate mode
            this.switchMode(this.isImporting);
            
            // If import is in progress, restore the progress display and log
            if (this.isImporting) {
                this.updateProgressDisplay();
                this.restoreLogEntries();
            }
        }
    }

    /**
     * Hide the import screen
     */
    hide() {
        if (this.elements.importTab) {
            this.elements.importTab.classList.add('hidden');
            this.isVisible = false;
        }
        
        // Don't stop import when hiding - let it continue in background
        // The import should only be stopped by user action or completion
    }

    /**
     * Start import process
     */
    async startImport() {
        if (this.isImporting) return;

        try {
            // Collect import settings from UI
            const importSettings = this.collectImportSettings();
            
            // Validate settings
            this.validateImportSettings(importSettings);

            // Save settings to storage
            this.saveImportSettings(importSettings);

            // Start the import using the import manager
            this.isImporting = true;
            this.switchMode(true);

            // Clear previous import state and reset progress
            this.clearImportState();

            this.addLogEntry('Starting import process...');
            this.addLogEntry(`Source: ${importSettings.sourcePath}`);
            this.addLogEntry(`Destination: ${importSettings.destinationPath}`);
            
            if (importSettings.backupEnabled) {
                this.addLogEntry(`Backup: ${importSettings.backupPath}`);
            }
            
            // Log enabled upload services
            const enabledServices = [];
            if (importSettings.uploadToZenTransfer) {
                enabledServices.push('ZenTransfer');
            }
            if (importSettings.uploadToAwsS3) {
                enabledServices.push('AWS S3');
            }
            if (importSettings.uploadToAzure) {
                enabledServices.push('Azure Blob Storage');
            }
            if (importSettings.uploadToGcp) {
                enabledServices.push('Google Cloud Storage');
            }
            
            if (enabledServices.length > 0) {
                this.addLogEntry(`Upload services enabled: ${enabledServices.join(', ')}`);
            }

            // Start the background import
            const jobId = await this.importManager.startImport(importSettings);
            this.addLogEntry(`Import job started: ${jobId}`);

        } catch (error) {
            console.error('Failed to start import:', error);
            this.addLogEntry(`Failed to start import: ${error.message}`);
            UIComponents.Notification.show('Failed to start import: ' + error.message, 'error');
            
            this.isImporting = false;
            this.switchMode(false);
        }
    }

    /**
     * Handle unhandled promise rejections in import process
     */
    handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection in import:', event.reason);
        if (this.isImporting) {
            this.addLogEntry(`Unexpected error: ${event.reason}`);
            this.isImporting = false;
            this.switchMode(false);
        }
    }

    /**
     * Collect import settings from UI
     * @returns {Object} Import settings
     */
    collectImportSettings() {
        // Get the current skipDuplicates setting
        const skipDuplicates = StorageManager.getImportSkipDuplicates();
        console.log('Import screen: collectImportSettings - skipDuplicates from StorageManager:', skipDuplicates);
        
        // Check if cloud upload is enabled
        const enableCloudUpload = this.elements.enableCloudUploadCheckbox?.checked || false;
        
        return {
            sourcePath: this.elements.importFromInput?.value?.trim(),
            destinationPath: this.elements.destinationInput?.value?.trim(),
            includeSubdirectories: this.elements.includeSubdirectoriesCheckbox?.checked !== false,
            backupEnabled: this.elements.enableBackupCheckbox?.checked || false,
            backupPath: this.elements.backupPathInput?.value?.trim(),
            uploadToZenTransfer: enableCloudUpload && (this.elements.uploadToZenTransferCheckbox?.checked || false),
            uploadToAwsS3: enableCloudUpload && (this.elements.uploadToAwsS3Checkbox?.checked || false),
            uploadToAzure: enableCloudUpload && (this.elements.uploadToAzureCheckbox?.checked || false),
            uploadToGcp: enableCloudUpload && (this.elements.uploadToGcpCheckbox?.checked || false),
            organizeIntoFolders: this.elements.organizeIntoFoldersCheckbox?.checked !== false,
            folderOrganizationType: this.elements.dateFolderRadio?.checked ? 'date' : 'custom',
            customFolderName: this.elements.customFolderNameInput?.value?.trim(),
            dateFormat: this.elements.dateFormatSelect?.value || '2025/05/26',
            skipDuplicates: skipDuplicates
        };
    }

    /**
     * Validate import settings
     * @param {Object} settings - Import settings to validate
     */
    validateImportSettings(settings) {
        if (!settings.sourcePath) {
            throw new Error('Please select import source directory');
        }

        if (!settings.destinationPath) {
            throw new Error('Please select destination directory');
        }

        if (settings.backupEnabled && !settings.backupPath) {
            throw new Error('Please select backup directory');
        }

        if (settings.organizeIntoFolders && 
            settings.folderOrganizationType === 'custom' && 
            !settings.customFolderName) {
            throw new Error('Please enter a custom folder name');
        }
    }

    /**
     * Save import settings to storage
     * @param {Object} settings - Import settings to save
     */
    saveImportSettings(settings) {
        StorageManager.setImportUploadEnabled(settings.uploadToZenTransfer);
        StorageManager.setImportUploadToAwsS3(settings.uploadToAwsS3);
        StorageManager.setImportUploadToAzure(settings.uploadToAzure);
        StorageManager.setImportUploadToGcp(settings.uploadToGcp);
        StorageManager.setImportIncludeSubdirectories(settings.includeSubdirectories);
        StorageManager.setImportOrganizeIntoFolders(settings.organizeIntoFolders);
        StorageManager.setImportFolderOrganizationType(settings.folderOrganizationType);
        if (settings.customFolderName) {
            StorageManager.setImportCustomFolderName(settings.customFolderName);
        }
        if (settings.dateFormat) {
            StorageManager.setImportDateFormat(settings.dateFormat);
        }
    }

    /**
     * Handle import progress updates from worker
     * @param {Object} progress - Progress data from worker
     */
    handleImportProgress(progress) {
        // Update internal progress tracking
        this.importProgress.total = progress.totalFiles;
        this.importProgress.completed = progress.successfulFiles;
        this.importProgress.failed = progress.failedFiles;
        this.importProgress.current = progress.currentFile;
        this.importProgress.uploadQueued = progress.uploadQueueCount || 0; // Track upload queue count

        // Update UI display
        this.updateProgressDisplay();

        // Update current file display
        if (progress.currentFile) {
            if (this.elements.currentFileName) {
                this.elements.currentFileName.textContent = `Processing: ${progress.currentFile.name}`;
            }
        } else {
            if (this.elements.currentFileName) {
                this.elements.currentFileName.textContent = progress.phase || 'Processing...';
            }
        }

        // Update current destination display
        if (progress.currentDestination && this.elements.currentFileName) {
            this.elements.currentFileName.textContent = `${progress.currentDestination}: ${progress.currentFile?.name || 'Processing...'}`;
        }
    }

    /**
     * Handle import completion
     * @param {Object} data - Completion data from worker
     */
    handleImportCompleted(data) {
        console.log('Import screen handling completion:', data);
        
        this.isImporting = false;
        this.importProgress.current = null;
        this.switchMode(false);

        // Handle different data structures
        const results = data.result || data.results || data;
        this.addLogEntry('Import completed successfully!');
        
        if (results && typeof results === 'object' && results.successfulFiles !== undefined) {
            const message = `Import completed! ${results.successfulFiles} files processed successfully`;
            if (results.failedFiles > 0) {
                this.addLogEntry(`${results.failedFiles} files failed to process`);
            }
            UIComponents.Notification.show(message, 'success');
        } else {
            this.addLogEntry('Import process finished');
            UIComponents.Notification.show('Import completed!', 'success');
        }
        
        this.updateProgressDisplay();
        
        // Clear log entries after a delay to allow user to see completion message
        setTimeout(() => {
            this.clearImportState();
        }, 5000);
    }

    /**
     * Handle import errors
     * @param {Object} data - Error data from worker
     */
    handleImportError(data) {
        this.isImporting = false;
        this.importProgress.current = null;
        this.switchMode(false);

        this.addLogEntry(`Import failed: ${data.error}`);
        UIComponents.Notification.show(`Import failed: ${data.error}`, 'error');
        this.updateProgressDisplay();
        
        // Clear log entries after a delay to allow user to see error message
        setTimeout(() => {
            this.clearImportState();
        }, 5000);
    }

    /**
     * Handle import cancellation
     * @param {Object} data - Cancellation data from worker
     */
    handleImportCancelled(data) {
        this.isImporting = false;
        this.importProgress.current = null;
        this.switchMode(false);

        this.addLogEntry('Import cancelled by user');
        UIComponents.Notification.show('Import cancelled', 'info');
        this.updateProgressDisplay();
        
        // Clear log entries after a delay to allow user to see cancellation message
        setTimeout(() => {
            this.clearImportState();
        }, 3000);
    }

    /**
     * Stop import process
     */
    async stopImport() {
        if (!this.isImporting) return;

        try {
            this.addLogEntry('Stopping import...');
            this.addLogEntry('Current file will finish, then import will stop');
            
            // Stop the import process (but let uploads continue)
            await this.importManager.cancelImport();
            
        } catch (error) {
            console.error('Failed to stop import:', error);
            this.addLogEntry(`Failed to stop import: ${error.message}`);
            
            // Force stop if cancel fails
            this.isImporting = false;
            this.importProgress.current = null;
            this.switchMode(false);
            this.addLogEntry('Import force stopped');
        }
    }

    /**
     * Update progress display
     */
    updateProgressDisplay() {
        // Update overall progress
        const overallProgress = this.importProgress.total > 0 
            ? Math.round((this.importProgress.completed + this.importProgress.failed) / this.importProgress.total * 100)
            : 0;
        
        if (this.elements.overallProgressBar) {
            this.elements.overallProgressBar.style.width = `${overallProgress}%`;
        }
        if (this.elements.overallProgressText) {
            this.elements.overallProgressText.textContent = `${overallProgress}%`;
        }

        // Update current file
        if (this.elements.currentFileName) {
            this.elements.currentFileName.textContent = this.importProgress.current 
                ? `Processing: ${this.importProgress.current.name}`
                : 'Idle';
        }

        // Update stats
        if (this.elements.totalFilesCount) {
            this.elements.totalFilesCount.textContent = this.importProgress.total;
        }
        if (this.elements.completedFilesCount) {
            this.elements.completedFilesCount.textContent = this.importProgress.completed;
        }
        if (this.elements.failedFilesCount) {
            this.elements.failedFilesCount.textContent = this.importProgress.failed;
        }
    }

    /**
     * Add entry to import log
     * @param {string} message - Log message
     */
    addLogEntry(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntryText = `[${timestamp}] ${message}`;
        
        // Store in memory for persistence
        this.importLogEntries.push(logEntryText);
        
        // Keep log size manageable (last 100 entries)
        if (this.importLogEntries.length > 100) {
            this.importLogEntries = this.importLogEntries.slice(-100);
        }
        
        // Add to DOM if visible
        if (this.elements.importLog) {
            const logEntry = document.createElement('div');
            logEntry.className = 'text-xs';
            logEntry.textContent = logEntryText;
            
            this.elements.importLog.appendChild(logEntry);
            
            // Auto-scroll to bottom
            const container = this.elements.importLog.parentElement;
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }
    }

    /**
     * Restore log entries when returning to the screen
     */
    restoreLogEntries() {
        if (this.elements.importLog && this.importLogEntries.length > 0) {
            // Clear existing log entries
            this.elements.importLog.innerHTML = '';
            
            // Restore all stored log entries
            this.importLogEntries.forEach(logEntryText => {
                const logEntry = document.createElement('div');
                logEntry.className = 'text-xs';
                logEntry.textContent = logEntryText;
                this.elements.importLog.appendChild(logEntry);
            });
            
            // Auto-scroll to bottom
            const container = this.elements.importLog.parentElement;
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }
    }

    /**
     * Clear import state and log entries
     */
    clearImportState() {
        // Clear stored log entries
        this.importLogEntries = [];
        
        // Clear DOM log entries
        if (this.elements.importLog) {
            this.elements.importLog.innerHTML = '';
        }
        
        // Reset progress
        this.importProgress = {
            total: 0,
            completed: 0,
            failed: 0,
            current: null,
            uploadQueued: 0
        };
        
        // Update display
        this.updateProgressDisplay();
    }

    /**
     * Check if screen is currently visible
     * @returns {boolean} True if visible
     */
    isScreenVisible() {
        return this.isVisible;
    }

    /**
     * Refresh service availability (called when auth state or settings change)
     */
    async refreshServiceAvailability() {
        if (this.isVisible && !this.isImporting) {
            await this.updateServiceAvailability();
        }
    }

    /**
     * Get import statistics
     * @returns {Object} Import stats
     */
    getImportStats() {
        return {
            isImporting: this.isImporting,
            progress: this.importProgress
        };
    }

    /**
     * Cleanup resources when screen is destroyed
     */
    destroy() {
        this.stopImport();
        
        if (this.importManager) {
            this.importManager.destroy();
            this.importManager = null;
        }
        
        this.isVisible = false;
    }

    /**
     * Toggle cloud services visibility
     */
    toggleCloudServices() {
        if (this.elements.cloudServicesContainer && this.elements.enableCloudUploadCheckbox) {
            const isEnabled = this.elements.enableCloudUploadCheckbox.checked;
            
            if (isEnabled) {
                this.elements.cloudServicesContainer.classList.remove('hidden');
            } else {
                this.elements.cloudServicesContainer.classList.add('hidden');
                
                // Disable and uncheck all cloud service checkboxes when cloud upload is disabled
                const cloudServiceCheckboxes = [
                    this.elements.uploadToZenTransferCheckbox,
                    this.elements.uploadToAwsS3Checkbox,
                    this.elements.uploadToAzureCheckbox,
                    this.elements.uploadToGcpCheckbox
                ];
                
                cloudServiceCheckboxes.forEach(checkbox => {
                    if (checkbox) {
                        checkbox.checked = false;
                    }
                });
            }

            this.validateInputs();
        }
    }
} 