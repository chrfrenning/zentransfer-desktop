/**
 * Settings Screen
 * Handles app settings, user account info, and app information
 */

import { UIComponents } from '../components/ui-components.js';
import { config } from '../config/app-config.js';
import { StorageManager } from '../components/storage-manager.js';

export class SettingsScreen {
    constructor(authManager, onNavigateToLogin = null) {
        this.authManager = authManager;
        this.onNavigateToLogin = onNavigateToLogin;
        this.isVisible = false;
        this.elements = {};
        this.onSettingsChangeCallback = null;
        
        this.initializeElements();
        // setupEventListeners is no longer needed - all handled in setupAdditionalEventListeners
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            settingsTab: document.getElementById('settingsTab'),
            userEmail: null, // Will be set after dynamic creation
            signOutBtn: null, // Will be set after dynamic creation
            downloadLatestBtn: null, // Will be set after dynamic creation
            helpBtn: null, // Will be set after dynamic creation
            privacyBtn: null, // Will be set after dynamic creation
            termsBtn: null // Will be set after dynamic creation
        };

        // Create additional settings sections (this will create all sections now)
        this.createAdditionalSettings();
    }

    /**
     * Create additional settings sections
     */
    createAdditionalSettings() {
        if (!this.elements.settingsTab) return;

        // Check if we need to create additional settings
        let additionalSettings = this.elements.settingsTab.querySelector('#additionalSettings');
        if (!additionalSettings) {
            additionalSettings = document.createElement('div');
            additionalSettings.id = 'additionalSettings';
            additionalSettings.className = 'space-y-4';
            
            additionalSettings.innerHTML = `
                <!-- Preferences Section -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                    <h3 class="text-lg font-semibold text-gray-900 mb-3">Preferences</h3>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="text-sm font-medium text-gray-700">Skip duplicates during import</span>
                                <p class="text-xs text-gray-500">Skip files that already exist in destination folders</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="skipDuplicatesToggle" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                            </label>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Disable notifications</span>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="disableNotificationsToggle" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- AWS S3 Section -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-2">
                            <!-- AWS S3 icon -->
                            <svg class="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM12 4.5L19.5 8 12 11.5 4.5 8 12 4.5zM4 9.5l7 3.5v7l-7-3.5v-7zm16 0v7l-7 3.5v-7l7-3.5z"/>
                            </svg>
                            <h3 class="text-lg font-semibold text-gray-900">AWS S3 Upload</h3>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="awsS3EnableToggle" class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                    </div>
                    
                    <div id="awsS3Settings" class="space-y-4 hidden">
                        <!-- Region -->
                        <div>
                            <label for="awsS3Region" class="block text-sm font-medium text-gray-700 mb-1">Region <span class="text-red-500">*</span></label>
                            <select id="awsS3Region" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm">
                                <option value="">Loading regions...</option>
                            </select>
                        </div>
                        
                        <!-- Bucket Name -->
                        <div>
                            <label for="awsS3Bucket" class="block text-sm font-medium text-gray-700 mb-1">Bucket Name <span class="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                id="awsS3Bucket"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm" 
                                placeholder="my-bucket-name"
                                required
                            >
                        </div>
                        
                        <!-- Storage Tier -->
                        <div>
                            <label for="awsS3StorageTier" class="block text-sm font-medium text-gray-700 mb-1">Storage Tier</label>
                            <select id="awsS3StorageTier" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm">
                                <option value="STANDARD" selected>Standard - Frequently accessed data</option>
                                <option value="REDUCED_REDUNDANCY">Reduced Redundancy - Non-critical, reproducible data</option>
                                <option value="STANDARD_IA">Standard-IA - Infrequently accessed data</option>
                                <option value="ONEZONE_IA">One Zone-IA - Infrequently accessed, non-critical data</option>
                                <option value="INTELLIGENT_TIERING">Intelligent Tiering - Automatic cost optimization</option>
                                <option value="GLACIER">Glacier - Long-term archive (minutes to hours retrieval)</option>
                                <option value="DEEP_ARCHIVE">Glacier Deep Archive - Long-term archive (12+ hours retrieval)</option>
                                <option value="GLACIER_IR">Glacier Instant Retrieval - Archive with instant access</option>
                            </select>
                            <p class="text-xs text-gray-500 mt-1">Choose the storage class based on your access patterns and cost requirements.</p>
                        </div>
                        
                        <!-- Access Key ID -->
                        <div id="awsS3AccessKeyContainer"></div>
                        
                        <!-- Secret Access Key -->
                        <div id="awsS3SecretKeyContainer"></div>
                        
                        <!-- Test Connection Button -->
                        <button id="testS3ConnectionBtn" class="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                            <svg id="testS3Icon" class="w-5 h-5 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                            <span id="testS3Text">Test Connection</span>
                        </button>
                    </div>
                </div>

                <!-- Azure Upload Section -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-2">
                            <!-- Azure icon -->
                            <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM12 4.5L19.5 8 12 11.5 4.5 8 12 4.5zM4 9.5l7 3.5v7l-7-3.5v-7zm16 0v7l-7 3.5v-7l7-3.5z"/>
                            </svg>
                            <h3 class="text-lg font-semibold text-gray-900">Azure Upload</h3>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="azureEnableToggle" class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                    </div>
                    
                    <div id="azureSettings" class="space-y-4 hidden">
                        <!-- Container Name -->
                        <div>
                            <label for="azureContainer" class="block text-sm font-medium text-gray-700 mb-1">Container Name <span class="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                id="azureContainer"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm" 
                                placeholder="my-container"
                                required
                            >
                        </div>
                        
                        <!-- Connection String -->
                        <div id="azureConnectionStringContainer"></div>
                        
                        <!-- Test Connection Button -->
                        <button id="testAzureConnectionBtn" class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                            <svg id="testAzureIcon" class="w-5 h-5 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                            <span id="testAzureText">Test Connection</span>
                        </button>
                    </div>
                </div>

                <!-- GCP Upload Section -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-2">
                            <!-- GCP icon -->
                            <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM12 4.5L19.5 8 12 11.5 4.5 8 12 4.5zM4 9.5l7 3.5v7l-7-3.5v-7zm16 0v7l-7 3.5v-7l7-3.5z"/>
                            </svg>
                            <h3 class="text-lg font-semibold text-gray-900">GCP Upload</h3>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="gcpEnableToggle" class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                    </div>
                    
                    <div id="gcpSettings" class="space-y-4 hidden">
                        <!-- Bucket Name -->
                        <div>
                            <label for="gcpBucket" class="block text-sm font-medium text-gray-700 mb-1">Bucket Name <span class="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                id="gcpBucket"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm" 
                                placeholder="my-gcp-bucket"
                                required
                            >
                        </div>
                        
                        <!-- Service Account Key File -->
                        <div>
                            <label for="gcpKeyFile" class="block text-sm font-medium text-gray-700 mb-1">Service Account Key (JSON) <span class="text-red-500">*</span></label>
                            <div class="flex items-center space-x-2">
                                <input 
                                    type="file" 
                                    id="gcpKeyFile"
                                    accept=".json"
                                    class="hidden"
                                    required
                                >
                                <button 
                                    type="button" 
                                    id="gcpKeyFileBtn"
                                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm text-left text-gray-500 hover:bg-gray-50 transition-colors duration-200"
                                >
                                    <span id="gcpKeyFileText">Choose JSON file...</span>
                                </button>
                                <button 
                                    type="button" 
                                    id="gcpClearKeyBtn"
                                    class="px-3 py-2 text-sm text-red-600 hover:text-red-700 font-medium transition-colors duration-200 hidden"
                                >
                                    Clear
                                </button>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Upload your GCP service account JSON key file. The content will be stored securely.</p>
                        </div>
                        
                        <!-- Test Connection Button -->
                        <button id="testGcpConnectionBtn" class="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:ring-2 focus:ring-red-500 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                            <svg id="testGcpIcon" class="w-5 h-5 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                            <span id="testGcpText">Test Connection</span>
                        </button>
                    </div>
                </div>

                <!-- Account Section -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                    <h3 class="text-lg font-semibold text-gray-900 mb-3">Account</h3>
                    <div id="accountContent" class="space-y-3">
                        <!-- Content will be dynamically updated based on auth state -->
                    </div>
                </div>

                <!-- Support Section -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                    <h3 class="text-lg font-semibold text-gray-900 mb-3">Support</h3>
                    <div class="space-y-3">
                        <button id="helpBtn" class="w-full text-left text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200">
                            Help & Support
                        </button>
                        <button id="privacyBtn" class="w-full text-left text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200">
                            Privacy Policy
                        </button>
                        <button id="termsBtn" class="w-full text-left text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200">
                            Terms of Service
                        </button>
                        <button id="downloadLatestBtn" class="w-full text-left text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200">
                            Download Latest Version
                        </button>
                        <button id="donateBtn" class="w-full text-left text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200">
                            Donate
                        </button>
                    </div>
                </div>

                <!-- App Info Section -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                    <h3 class="text-lg font-semibold text-gray-900 mb-3">App Info</h3>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Version</span>
                            <span class="text-sm font-medium text-gray-900">${config.APP_VERSION}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Build</span>
                            <span class="text-sm font-medium text-gray-900">${config.IS_DEVELOPMENT ? 'Development' : 'Production'}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span id="serverLabel" class="text-sm text-gray-600 select-none" style="cursor: default">Server</span>
                            <span class="text-sm font-medium text-gray-900">${config.SERVER_BASE_URL}</span>
                        </div>
                    </div>
                </div>

                <!-- Storage Section -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                    <h3 class="text-lg font-semibold text-gray-900 mb-3">Storage</h3>
                    <div class="space-y-3">
                        <button id="clearCacheBtn" class="w-full text-left text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200">
                            Clear Cache
                        </button>
                        <button id="clearDataBtn" class="w-full text-left text-sm text-red-600 hover:text-red-700 font-medium transition-colors duration-200">
                            Clear All Data
                        </button>
                    </div>
                </div>

                <!-- Debug Section (Development Only) -->
                ${config.IS_DEVELOPMENT ? `
                    <div class="bg-white rounded-lg p-4 shadow-sm border-2 border-yellow-200">
                        <h3 class="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                            <span class="mr-2">🔧</span>
                            Debug Tools
                        </h3>
                        <div class="space-y-3">
                            <button id="showTokenBtn" class="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200">
                                Show Token Info
                            </button>
                            <button id="testNotificationBtn" class="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200">
                                Test Notification
                            </button>
                            <button id="simulateErrorBtn" class="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200">
                                Simulate Error
                            </button>
                            <div class="text-xs text-gray-500 mt-2 p-2 bg-yellow-50 rounded text-xs font-mono break-all">
                                Development mode is enabled. These tools are only available in development.
                            </div>
                        </div>
                    </div>
                ` : ''}
            `;

            // Find the container with the existing sections (the div with class "space-y-4")
            const settingsContainer = this.elements.settingsTab.querySelector('.space-y-4');
            if (settingsContainer) {
                // Replace the entire content of the settings container
                settingsContainer.appendChild(additionalSettings);
            } else {
                // Fallback: append to the settings tab if container not found
                this.elements.settingsTab.appendChild(additionalSettings);
            }
        }

        this.elements.additionalSettings = additionalSettings;
        this.setupAdditionalEventListeners();
    }

    /**
     * Setup additional event listeners for new settings
     */
    setupAdditionalEventListeners() {
        // Update element references now that they're created
        this.elements.userEmail = document.getElementById('userEmail');
        this.elements.signOutBtn = document.getElementById('signOutBtn');
        this.elements.downloadLatestBtn = document.getElementById('downloadLatestBtn');
        this.elements.helpBtn = document.getElementById('helpBtn');
        this.elements.privacyBtn = document.getElementById('privacyBtn');
        this.elements.termsBtn = document.getElementById('termsBtn');

        // Create secure input fields for Azure and AWS S3, and setup GCP file handling
        this.createAzureSecureInputs();
        this.setupGcpFileHandling();
        this.createAwsS3SecureInputs();

        // Setup hidden developer console trigger
        const serverLabel = document.getElementById('serverLabel');
        if (serverLabel) {
            let clickCount = 0;
            let clickTimer = null;
            
            serverLabel.addEventListener('click', () => {
                clickCount++;
                
                if (clickCount === 1) {
                    clickTimer = setTimeout(() => {
                        clickCount = 0;
                    }, 300);
                } else if (clickCount === 2) {
                    clearTimeout(clickTimer);
                    clickCount = 0;
                    
                    // Toggle dev tools directly using require
                    if (typeof require !== 'undefined') {
                        try {
                            const { BrowserWindow } = require('electron');
                            const currentWindow = BrowserWindow.getFocusedWindow();
                            if (currentWindow) {
                                currentWindow.webContents.toggleDevTools();
                            }
                        } catch (error) {
                            console.log('Developer tools can only be opened in the desktop app');
                        }
                    } else {
                        console.log('Developer tools can only be opened in the desktop app');
                    }
                }
            });
        }

        // Preference toggles
        const disableNotificationsToggle = document.getElementById('disableNotificationsToggle');
        const skipDuplicatesToggle = document.getElementById('skipDuplicatesToggle');
        const azureEnableToggle = document.getElementById('azureEnableToggle');

        if (disableNotificationsToggle) {
            disableNotificationsToggle.addEventListener('change', (e) => {
                this.updatePreference('disableNotifications', e.target.checked);
            });
        }

        if (skipDuplicatesToggle) {
            skipDuplicatesToggle.addEventListener('change', (e) => {
                // Use StorageManager instead of preferences for consistency with import screen
                StorageManager.setImportSkipDuplicates(e.target.checked);
                console.log(`Skip duplicates setting updated: ${e.target.checked}`);
            });
        }

        if (azureEnableToggle) {
            azureEnableToggle.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                this.updatePreference('azureEnabled', isEnabled);
                this.resetAzureTestButton();
                
                if (azureSettings) {
                    if (isEnabled) {
                        azureSettings.classList.remove('hidden');
                    } else {
                        azureSettings.classList.add('hidden');
                    }
                }
            });
        }

        if (azureContainer) {
            azureContainer.addEventListener('input', (e) => {
                this.updatePreference('azureContainer', e.target.value);
                this.resetAzureTestButton();
            });
        }

        if (testAzureConnectionBtn) {
            testAzureConnectionBtn.addEventListener('click', () => {
                this.testAzureConnection();
            });
        }

        // GCP settings
        const gcpEnableToggle = document.getElementById('gcpEnableToggle');
        const gcpSettings = document.getElementById('gcpSettings');
        const gcpBucket = document.getElementById('gcpBucket');
        const testGcpConnectionBtn = document.getElementById('testGcpConnectionBtn');

        // Track if GCP connection was tested successfully
        this.gcpConnectionTested = false;

        if (gcpEnableToggle) {
            gcpEnableToggle.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                this.updatePreference('gcpEnabled', isEnabled);
                this.resetGcpTestButton();
                
                if (gcpSettings) {
                    if (isEnabled) {
                        gcpSettings.classList.remove('hidden');
                    } else {
                        gcpSettings.classList.add('hidden');
                    }
                }
            });
        }

        if (gcpBucket) {
            gcpBucket.addEventListener('input', (e) => {
                this.updatePreference('gcpBucket', e.target.value);
                this.resetGcpTestButton();
            });
        }

        if (testGcpConnectionBtn) {
            testGcpConnectionBtn.addEventListener('click', () => {
                this.testGcpConnection();
            });
        }

        // AWS S3 settings
        const awsS3EnableToggle = document.getElementById('awsS3EnableToggle');
        const awsS3Settings = document.getElementById('awsS3Settings');
        const awsS3Region = document.getElementById('awsS3Region');
        const awsS3Bucket = document.getElementById('awsS3Bucket');
        const awsS3StorageTier = document.getElementById('awsS3StorageTier');
        const testS3ConnectionBtn = document.getElementById('testS3ConnectionBtn');

        // Track if connection was tested successfully
        this.s3ConnectionTested = false;

        if (awsS3EnableToggle) {
            awsS3EnableToggle.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                this.updatePreference('awsS3Enabled', isEnabled);
                this.resetS3TestButton();
                
                if (awsS3Settings) {
                    if (isEnabled) {
                        awsS3Settings.classList.remove('hidden');
                    } else {
                        awsS3Settings.classList.add('hidden');
                    }
                }
            });
        }

        if (awsS3Region) {
            awsS3Region.addEventListener('change', (e) => {
                this.updatePreference('awsS3Region', e.target.value);
                this.resetS3TestButton();
            });
        }

        if (awsS3Bucket) {
            awsS3Bucket.addEventListener('input', (e) => {
                this.updatePreference('awsS3Bucket', e.target.value);
                this.resetS3TestButton();
            });
        }

        if (awsS3StorageTier) {
            awsS3StorageTier.addEventListener('change', (e) => {
                this.updatePreference('awsS3StorageTier', e.target.value);
                this.resetS3TestButton();
            });
        }

        if (testS3ConnectionBtn) {
            testS3ConnectionBtn.addEventListener('click', () => {
                this.testS3Connection();
            });
        }

        // Account section buttons
        if (this.elements.signOutBtn) {
            this.elements.signOutBtn.addEventListener('click', () => {
                this.signOut();
            });
        }

        // Support section buttons
        if (this.elements.downloadLatestBtn) {
            this.elements.downloadLatestBtn.addEventListener('click', () => {
                this.openExternal('https://zentransfer.io/download/');
            });
        }

        if (this.elements.helpBtn) {
            this.elements.helpBtn.addEventListener('click', () => {
                this.openExternal(config.URLS.HELP);
            });
        }

        if (this.elements.privacyBtn) {
            this.elements.privacyBtn.addEventListener('click', () => {
                this.openExternal(config.URLS.PRIVACY);
            });
        }

        if (this.elements.termsBtn) {
            this.elements.termsBtn.addEventListener('click', () => {
                this.openExternal(config.URLS.TERMS);
            });
        }

        // Storage buttons
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        const clearDataBtn = document.getElementById('clearDataBtn');

        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.clearCache();
            });
        }

        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => {
                this.clearAllData();
            });
        }

        // Debug buttons (development only)
        if (config.IS_DEVELOPMENT) {
            const showTokenBtn = document.getElementById('showTokenBtn');
            const testNotificationBtn = document.getElementById('testNotificationBtn');
            const simulateErrorBtn = document.getElementById('simulateErrorBtn');

            if (showTokenBtn) {
                showTokenBtn.addEventListener('click', () => {
                    this.showTokenInfo();
                });
            }

            if (testNotificationBtn) {
                testNotificationBtn.addEventListener('click', () => {
                    this.testNotification();
                });
            }

            if (simulateErrorBtn) {
                simulateErrorBtn.addEventListener('click', () => {
                    this.simulateError();
                });
            }
        }

        // Donate button
        const donateBtn = document.getElementById('donateBtn');
        if (donateBtn) {
            donateBtn.addEventListener('click', () => {
                this.openExternal('https://livewall.no/blog/supporting-the-zentransfer-app');
            });
        }
    }

    /**
     * Show the settings screen
     */
    show() {
        if (this.elements.settingsTab) {
            this.elements.settingsTab.classList.remove('hidden');
            this.isVisible = true;
            
            // Update user info
            this.updateUserInfo();
            
            // Load preferences
            this.loadPreferences();
        }
    }

    /**
     * Hide the settings screen
     */
    hide() {
        if (this.elements.settingsTab) {
            this.elements.settingsTab.classList.add('hidden');
            this.isVisible = false;
        }
    }

    /**
     * Update user information display
     */
    updateUserInfo() {
        this.updateAccountSection();
    }

    /**
     * Update account section based on authentication state
     */
    updateAccountSection() {
        const accountContent = document.getElementById('accountContent');
        if (!accountContent) return;

        const isLoggedIn = this.authManager.isLoggedIn();
        
        if (isLoggedIn) {
            // User is logged in - show user info and sign out
            const user = this.authManager.getCurrentUser();
            accountContent.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-600">Email</span>
                    <span id="userEmail" class="text-sm font-medium text-gray-900">${user?.email || 'Unknown'}</span>
                </div>
                <button id="signOutBtn" class="w-full text-left text-sm text-red-600 hover:text-red-700 font-medium transition-colors duration-200">
                    Sign Out
                </button>
            `;
            
            // Setup sign out button
            const signOutBtn = document.getElementById('signOutBtn');
            if (signOutBtn) {
                signOutBtn.addEventListener('click', () => this.signOut());
            }
        } else {
            // User is in offline mode - show login options
            accountContent.innerHTML = `
                <div class="text-center space-y-3">
                    <div class="text-sm text-gray-600 mb-3">
                        Log in to relay files via ZenTransfer.io.
                    </div>
                    <button id="loginBtn" class="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors duration-200">
                        Log In
                    </button>
                    <button id="createAccountBtn" class="w-full px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 font-medium transition-colors duration-200">
                        Create New Account
                    </button>
                    <div class="text-center mt-2">
                        <button onclick="window.appController?.screenManager?.screens?.settings?.openExternal('https://zentransfer.io')" class="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-200 underline bg-transparent border-none cursor-pointer">
                            Click to learn more about ZenTransfer
                        </button>
                    </div>
                </div>
            `;
            
            // Setup login and create account buttons
            const loginBtn = document.getElementById('loginBtn');
            const createAccountBtn = document.getElementById('createAccountBtn');
            
            if (loginBtn) {
                loginBtn.addEventListener('click', () => {
                    // Navigate to login screen using the new trigger method
                    if (this.onNavigateToLogin) {
                        this.onNavigateToLogin();
                    } else {
                        // Use the new triggerLogin method instead of logout
                        this.authManager.triggerLogin();
                    }
                });
            }
            
            if (createAccountBtn) {
                createAccountBtn.addEventListener('click', () => {
                    this.openExternal('https://zentransfer.io/register');
                });
            }
        }
        
        // Update element references
        this.elements.userEmail = document.getElementById('userEmail');
        this.elements.signOutBtn = document.getElementById('signOutBtn');
    }

    /**
     * Sign out the current user
     */
    async signOut() {
        const confirmed = await UIComponents.Modal.confirm(
            'Are you sure you want to sign out? This will clear all stored data and close the application.',
            {
                title: 'Sign Out',
                confirmText: 'Sign Out & Exit',
                cancelText: 'Cancel',
                type: 'warning'
            }
        );

        if (confirmed) {
            try {
                // Clear all stored data
                console.log('Clearing all stored data...');
                
                // Clear localStorage
                localStorage.clear();
                
                // Clear sessionStorage
                sessionStorage.clear();
                
                // Clear caches if available
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                
                // Sign out through auth manager
                this.authManager.logout();
                
                console.log('Data cleared, signing out...');
                
                // Exit the application if in Electron environment
                if (typeof require !== 'undefined') {
                    try {
                        const { ipcRenderer } = require('electron');
                        // Give a brief moment for cleanup to complete
                        setTimeout(() => {
                            ipcRenderer.invoke('app-quit');
                        }, 500);
                    } catch (error) {
                        console.error('Failed to quit app via IPC:', error);
                        // Fallback: try to close the window
                        window.close();
                    }
                } else {
                    // Web environment - close the window/tab
                    window.close();
                }
                
            } catch (error) {
                console.error('Error during sign out:', error);
                UIComponents.Notification.show('Sign out completed, but some data may not have been cleared.', 'warning');
                
                // Still try to exit even if there was an error
                if (typeof require !== 'undefined') {
                    try {
                        const { ipcRenderer } = require('electron');
                        setTimeout(() => {
                            ipcRenderer.invoke('app-quit');
                        }, 1000);
                    } catch (ipcError) {
                        window.close();
                    }
                } else {
                    window.close();
                }
            }
        }
    }

    /**
     * Open external URL
     * @param {string} url - URL to open
     */
    openExternal(url) {
        if (typeof require !== 'undefined') {
            // Electron environment
            const { shell } = require('electron');
            shell.openExternal(url);
        } else {
            // Web environment
            window.open(url, '_blank');
        }
    }

    /**
     * Set callback for settings changes
     * @param {Function} callback - Callback function to call when settings change
     */
    setOnSettingsChangeCallback(callback) {
        this.onSettingsChangeCallback = callback;
    }

    /**
     * Update user preference
     * @param {string} key - Preference key
     * @param {any} value - Preference value
     */
    updatePreference(key, value) {
        try {
            const preferences = this.getPreferences();
            preferences[key] = value;
            localStorage.setItem('zentransfer_preferences', JSON.stringify(preferences));
            
            // Special handling for notification preference changes - no notification needed!
            if (key === 'disableNotifications') {
                // Just log the change, don't show a notification (that would be ironic!)
                console.log(`Notifications ${value ? 'disabled' : 'enabled'}`);
            } else {
                UIComponents.Notification.show(`Preference "${key}" updated.`, 'success');
            }
            
            console.log(`Preference updated: ${key} = ${value}`);
            
            // Call settings change callback if it's a cloud service setting
            const cloudServiceKeys = ['awsS3Enabled', 'awsS3Region', 'awsS3Bucket', 'awsS3AccessKey', 'awsS3SecretKey',
                                     'azureEnabled', 'azureConnectionString', 'azureContainer',
                                     'gcpEnabled', 'gcpBucket', 'gcpServiceAccountKey'];
            
            if (cloudServiceKeys.includes(key) && this.onSettingsChangeCallback) {
                this.onSettingsChangeCallback();
            }
        } catch (error) {
            console.error('Failed to update preference:', error);
            UIComponents.Notification.forceShow('Failed to update preference.', 'error');
        }
    }

    /**
     * Get user preferences
     * @returns {Object} User preferences
     */
    getPreferences() {
        try {
            const preferences = localStorage.getItem('zentransfer_preferences');
            return preferences ? JSON.parse(preferences) : {
                disableNotifications: true,
                azureEnabled: false,
                azureContainer: '',
                azureConnectionString: '',
                gcpEnabled: false,
                gcpBucket: '',
                gcpServiceAccountKey: '',
                awsS3Enabled: false,
                awsS3Region: '',
                awsS3Bucket: '',
                awsS3StorageTier: 'STANDARD',
                awsS3AccessKey: '',
                awsS3SecretKey: ''
            };
        } catch (error) {
            console.error('Failed to load preferences:', error);
            return {
                disableNotifications: true,
                azureEnabled: false,
                azureContainer: '',
                azureConnectionString: '',
                gcpEnabled: false,
                gcpBucket: '',
                gcpServiceAccountKey: '',
                awsS3Enabled: false,
                awsS3Region: '',
                awsS3Bucket: '',
                awsS3StorageTier: 'STANDARD',
                awsS3AccessKey: '',
                awsS3SecretKey: ''
            };
        }
    }

    /**
     * Load preferences into UI
     */
    loadPreferences() {
        const preferences = this.getPreferences();
        
        const disableNotificationsToggle = document.getElementById('disableNotificationsToggle');
        const skipDuplicatesToggle = document.getElementById('skipDuplicatesToggle');
        const azureEnableToggle = document.getElementById('azureEnableToggle');
        const azureSettings = document.getElementById('azureSettings');
        const azureContainer = document.getElementById('azureContainer');
        const azureConnectionString = document.getElementById('azureConnectionString');
        const gcpEnableToggle = document.getElementById('gcpEnableToggle');
        const gcpSettings = document.getElementById('gcpSettings');
        const gcpBucket = document.getElementById('gcpBucket');
        const awsS3EnableToggle = document.getElementById('awsS3EnableToggle');
        const awsS3Settings = document.getElementById('awsS3Settings');
        const awsS3Region = document.getElementById('awsS3Region');
        const awsS3Bucket = document.getElementById('awsS3Bucket');
        const awsS3StorageTier = document.getElementById('awsS3StorageTier');
        const awsS3AccessKey = document.getElementById('awsS3AccessKey');
        const awsS3SecretKey = document.getElementById('awsS3SecretKey');

        if (disableNotificationsToggle) disableNotificationsToggle.checked = preferences.disableNotifications;
        
        // Load skipDuplicates from StorageManager (not preferences) for consistency
        if (skipDuplicatesToggle) skipDuplicatesToggle.checked = StorageManager.getImportSkipDuplicates();
        
        if (azureEnableToggle) {
            azureEnableToggle.checked = preferences.azureEnabled;
            
            // Show/hide Azure settings based on toggle state
            if (azureSettings) {
                if (preferences.azureEnabled) {
                    azureSettings.classList.remove('hidden');
                } else {
                    azureSettings.classList.add('hidden');
                }
            }
        }
        
        if (azureContainer) azureContainer.value = preferences.azureContainer;
        if (azureConnectionString) azureConnectionString.value = preferences.azureConnectionString;
        
        if (gcpEnableToggle) {
            gcpEnableToggle.checked = preferences.gcpEnabled;
            
            // Show/hide GCP settings based on toggle state
            if (gcpSettings) {
                if (preferences.gcpEnabled) {
                    gcpSettings.classList.remove('hidden');
                } else {
                    gcpSettings.classList.add('hidden');
                }
            }
        }
        
        if (gcpBucket) gcpBucket.value = preferences.gcpBucket;
        
        // Update GCP file button text if key is already stored
        if (preferences.gcpServiceAccountKey) {
            this.updateGcpFileButtonText('✓ Service account key loaded');
        }
        
        if (awsS3EnableToggle) {
            awsS3EnableToggle.checked = preferences.awsS3Enabled;
            
            // Show/hide AWS S3 settings based on toggle state
            if (awsS3Settings) {
                if (preferences.awsS3Enabled) {
                    awsS3Settings.classList.remove('hidden');
                } else {
                    awsS3Settings.classList.add('hidden');
                }
            }
        }
        
        if (awsS3Region) awsS3Region.value = preferences.awsS3Region;
        if (awsS3Bucket) awsS3Bucket.value = preferences.awsS3Bucket;
        if (awsS3StorageTier) awsS3StorageTier.value = preferences.awsS3StorageTier;
        if (awsS3AccessKey) awsS3AccessKey.value = preferences.awsS3AccessKey;
        if (awsS3SecretKey) awsS3SecretKey.value = preferences.awsS3SecretKey;
    }

    /**
     * Clear application cache
     */
    async clearCache() {
        const confirmed = await UIComponents.Modal.confirm(
            'This will clear temporary files and cached data. Continue?',
            {
                title: 'Clear Cache',
                confirmText: 'Clear Cache',
                cancelText: 'Cancel',
                type: 'info'
            }
        );

        if (confirmed) {
            try {
                // Clear various caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }

                // Clear session storage
                sessionStorage.clear();

                UIComponents.Notification.show('Cache cleared successfully.', 'success');
            } catch (error) {
                console.error('Failed to clear cache:', error);
                UIComponents.Notification.show('Failed to clear cache.', 'error');
            }
        }
    }

    /**
     * Clear all application data
     */
    async clearAllData() {
        const confirmed = await UIComponents.Modal.confirm(
            'This will permanently delete all your data including login information, preferences, and upload history. This action cannot be undone.',
            {
                title: 'Clear All Data',
                confirmText: 'Delete All Data',
                cancelText: 'Cancel',
                type: 'danger'
            }
        );

        if (confirmed) {
            try {
                // Clear all localStorage
                localStorage.clear();
                
                // Clear sessionStorage
                sessionStorage.clear();
                
                // Clear caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }

                UIComponents.Notification.show('All data cleared. You will be signed out.', 'info');
                
                // Sign out user
                setTimeout(() => {
                    this.authManager.logout();
                }, 2000);
                
            } catch (error) {
                console.error('Failed to clear all data:', error);
                UIComponents.Notification.show('Failed to clear all data.', 'error');
            }
        }
    }

    /**
     * Show token information (debug)
     */
    showTokenInfo() {
        const tokenInfo = this.authManager.getTokenInfo();
        
        const content = `
            <div class="space-y-3 text-sm">
                <div>
                    <strong>Token Valid:</strong> ${tokenInfo.isValid ? 'Yes' : 'No'}
                </div>
                <div>
                    <strong>Time Remaining:</strong> ${Math.round(tokenInfo.timeRemaining / 1000 / 60)} minutes
                </div>
                <div>
                    <strong>User Email:</strong> ${tokenInfo.metadata?.email || 'N/A'}
                </div>
                <div>
                    <strong>Saved At:</strong> ${tokenInfo.metadata?.savedAt ? new Date(tokenInfo.metadata.savedAt).toLocaleString() : 'N/A'}
                </div>
                <div class="mt-4 p-3 bg-gray-100 rounded text-xs font-mono break-all">
                    <strong>Token:</strong><br>
                    ${tokenInfo.token ? tokenInfo.token.substring(0, 50) + '...' : 'No token'}
                </div>
            </div>
        `;

        UIComponents.Modal.create(content, {
            title: 'Token Information',
            size: 'lg'
        });
    }

    /**
     * Test notification system (debug)
     */
    testNotification() {
        const types = ['success', 'error', 'warning', 'info'];
        const messages = [
            'This is a success notification!',
            'This is an error notification!',
            'This is a warning notification!',
            'This is an info notification!'
        ];

        // Check if notifications are disabled and inform user
        if (UIComponents.Notification.areDisabled()) {
            console.log('Notifications are currently disabled. Testing will force show notifications.');
        }

        types.forEach((type, index) => {
            setTimeout(() => {
                // Use forceShow to bypass notification preferences for testing
                UIComponents.Notification.forceShow(messages[index], type);
            }, index * 1000);
        });
    }

    /**
     * Simulate an error (debug)
     */
    simulateError() {
        UIComponents.Modal.confirm(
            'This will simulate an application error. Continue?',
            {
                title: 'Simulate Error',
                confirmText: 'Simulate',
                cancelText: 'Cancel',
                type: 'warning'
            }
        ).then(confirmed => {
            if (confirmed) {
                setTimeout(() => {
                    throw new Error('Simulated error for testing purposes');
                }, 1000);
            }
        });
    }

    /**
     * Get app statistics
     * @returns {Object} App statistics
     */
    getAppStats() {
        const preferences = this.getPreferences();
        const user = this.authManager.getCurrentUser();
        
        return {
            isLoggedIn: this.authManager.isLoggedIn(),
            userEmail: user?.email,
            preferences,
            storageUsed: this.getStorageUsage(),
            appVersion: config.APP_VERSION,
            environment: config.IS_DEVELOPMENT ? 'development' : 'production'
        };
    }

    /**
     * Get storage usage information
     * @returns {Object} Storage usage stats
     */
    getStorageUsage() {
        try {
            let totalSize = 0;
            let itemCount = 0;

            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length;
                    itemCount++;
                }
            }

            return {
                totalSize,
                itemCount,
                formattedSize: this.formatBytes(totalSize)
            };
        } catch (error) {
            return {
                totalSize: 0,
                itemCount: 0,
                formattedSize: '0 B'
            };
        }
    }

    /**
     * Format bytes for display
     * @param {number} bytes - Number of bytes
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Check if screen is currently visible
     * @returns {boolean} True if visible
     */
    isScreenVisible() {
        return this.isVisible;
    }

    /**
     * Export settings for backup
     * @returns {Object} Exportable settings
     */
    exportSettings() {
        return {
            preferences: this.getPreferences(),
            appVersion: config.APP_VERSION,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import settings from backup
     * @param {Object} settings - Settings to import
     */
    importSettings(settings) {
        try {
            if (settings.preferences) {
                localStorage.setItem('zentransfer_preferences', JSON.stringify(settings.preferences));
                this.loadPreferences();
                UIComponents.Notification.show('Settings imported successfully.', 'success');
            } else {
                throw new Error('Invalid settings format');
            }
        } catch (error) {
            console.error('Failed to import settings:', error);
            UIComponents.Notification.show('Failed to import settings.', 'error');
        }
    }

    /**
     * Cleanup resources when screen is destroyed
     */
    destroy() {
        this.isVisible = false;
    }

    /**
     * Check if notifications are disabled
     * @returns {boolean} True if notifications are disabled
     */
    static areNotificationsDisabled() {
        try {
            const preferences = localStorage.getItem('zentransfer_preferences');
            if (preferences) {
                const parsedPreferences = JSON.parse(preferences);
                return parsedPreferences.disableNotifications === true;
            }
            return true; // Default to notifications disabled
        } catch (error) {
            console.error('Failed to check notification preferences:', error);
            return true; // Default to notifications disabled if error
        }
    }

    /**
     * Create secure input fields for Azure
     */
    createAzureSecureInputs() {
        const connectionStringContainer = document.getElementById('azureConnectionStringContainer');

        if (connectionStringContainer) {
            const connectionStringInput = UIComponents.SecureInput.create({
                id: 'azureConnectionString',
                label: 'Connection String',
                placeholder: 'DefaultEndpointsProtocol=https;AccountName=...',
                required: true
            });
            connectionStringContainer.appendChild(connectionStringInput);

            // Add event listener for connection string changes
            const connectionStringField = document.getElementById('azureConnectionString');
            if (connectionStringField) {
                connectionStringField.addEventListener('input', (e) => {
                    this.updatePreference('azureConnectionString', e.target.value);
                    this.resetAzureTestButton();
                });
            }
        }
    }

    /**
     * Setup GCP file handling
     */
    setupGcpFileHandling() {
        const gcpKeyFile = document.getElementById('gcpKeyFile');
        const gcpKeyFileBtn = document.getElementById('gcpKeyFileBtn');
        const gcpClearKeyBtn = document.getElementById('gcpClearKeyBtn');

        if (gcpKeyFileBtn && gcpKeyFile) {
            gcpKeyFileBtn.addEventListener('click', () => {
                gcpKeyFile.click();
            });
        }

        if (gcpKeyFile) {
            gcpKeyFile.addEventListener('change', (e) => {
                this.handleGcpKeyFileUpload(e);
            });
        }

        if (gcpClearKeyBtn) {
            gcpClearKeyBtn.addEventListener('click', () => {
                this.clearGcpKey();
            });
        }
    }

    /**
     * Handle GCP service account key file upload
     * @param {Event} event - File input change event
     */
    async handleGcpKeyFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.name.endsWith('.json')) {
            UIComponents.Notification.forceShow('Please select a valid JSON file.', 'error');
            event.target.value = '';
            return;
        }

        try {
            // Read the file content
            const fileContent = await this.readFileAsText(file);
            
            // Check if file content is empty or whitespace only
            if (!fileContent || fileContent.trim().length === 0) {
                throw new Error('File is empty or contains only whitespace');
            }
            
            // Validate JSON structure
            let keyData;
            try {
                keyData = JSON.parse(fileContent);
            } catch (parseError) {
                throw new SyntaxError('Invalid JSON format in file');
            }
            
            // Check if parsed data is an object
            if (typeof keyData !== 'object' || keyData === null || Array.isArray(keyData)) {
                throw new Error('JSON file must contain a valid object');
            }
            
            // Check for required properties (type and universe_domain)
            if (!keyData.hasOwnProperty('type') || !keyData.hasOwnProperty('universe_domain')) {
                throw new Error('Invalid service account key format - missing required properties');
            }

            // Store the key content
            this.updatePreference('gcpServiceAccountKey', fileContent);
            
            // Update UI to show successful upload
            this.updateGcpFileButtonText('✓ Service account key loaded');
            this.resetGcpTestButton();

            UIComponents.Notification.show('GCP service account key uploaded and validated successfully.', 'success');

        } catch (error) {
            console.error('Failed to process GCP key file:', error);
            
            let errorMessage = 'Invalid JSON file or service account key format.';
            if (error.message.includes('missing required properties')) {
                errorMessage = 'Invalid service account key - missing required properties (type, universe_domain).';
            } else if (error.message.includes('File is empty')) {
                errorMessage = 'The selected file is empty. Please choose a valid JSON file.';
            } else if (error.message.includes('JSON file must contain a valid object')) {
                errorMessage = 'Invalid JSON structure. The file must contain a JSON object, not an array or primitive value.';
            } else if (error instanceof SyntaxError || error.name === 'SyntaxError' || error.message.includes('Invalid JSON format')) {
                errorMessage = 'Invalid JSON file format. Please ensure the file contains valid JSON syntax.';
            }
            
            console.log('About to show error notification:', errorMessage);
            
            // Always show the error notification (force show to bypass notification preferences)
            try {
                const notificationResult = UIComponents.Notification.forceShow(errorMessage, 'error');
                console.log('Notification result:', notificationResult);
            } catch (notificationError) {
                console.error('Failed to show notification:', notificationError);
                alert('Error: ' + errorMessage);
            }
            
            // Clear the file input
            event.target.value = '';
            
            // Reset the button text to default state
            this.updateGcpFileButtonText('Choose JSON file...');
        }
    }

    /**
     * Read file as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Update GCP file button text and show/hide clear button
     * @param {string} text - Text to display
     */
    updateGcpFileButtonText(text) {
        const gcpKeyFileText = document.getElementById('gcpKeyFileText');
        const gcpClearKeyBtn = document.getElementById('gcpClearKeyBtn');

        if (gcpKeyFileText) {
            gcpKeyFileText.textContent = text;
        }

        if (gcpClearKeyBtn) {
            if (text !== 'Choose JSON file...') {
                gcpClearKeyBtn.classList.remove('hidden');
            } else {
                gcpClearKeyBtn.classList.add('hidden');
            }
        }
    }

    /**
     * Clear GCP service account key
     */
    clearGcpKey() {
        this.updatePreference('gcpServiceAccountKey', '');
        this.updateGcpFileButtonText('Choose JSON file...');
        this.resetGcpTestButton();
        
        // Clear the file input
        const gcpKeyFile = document.getElementById('gcpKeyFile');
        if (gcpKeyFile) {
            gcpKeyFile.value = '';
        }

        UIComponents.Notification.show('GCP service account key cleared.', 'info');
    }

    /**
     * Test GCP Cloud Storage connection with enhanced animations and feedback
     */
    async testGcpConnection() {
        const testBtn = document.getElementById('testGcpConnectionBtn');
        const testIcon = document.getElementById('testGcpIcon');
        const testText = document.getElementById('testGcpText');
        const preferences = this.getPreferences();

        // Validate required fields
        if (!preferences.gcpBucket || !preferences.gcpServiceAccountKey) {
            UIComponents.Notification.show('Please fill in all required GCP fields.', 'warning');
            return;
        }

        // Validate JSON key format
        try {
            const keyData = JSON.parse(preferences.gcpServiceAccountKey);
            if (!keyData.hasOwnProperty('type') || !keyData.hasOwnProperty('universe_domain')) {
                throw new Error('Invalid service account key format');
            }
        } catch (error) {
            UIComponents.Notification.show('Invalid service account key format.', 'error');
            return;
        }

        // Disable button and start loading animation
        if (testBtn && testIcon && testText) {
            testBtn.disabled = true;
            testBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
            testBtn.classList.add('bg-red-600');
            
            // Loading state with spinning icon
            testIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            `;
            testIcon.classList.add('animate-spin');
            testText.textContent = 'Testing Connection...';
        }

        try {
            // Import upload service factory
            const { uploadServiceFactory } = await import('../upload/upload-service-factory.js');
            
            // Create service with current settings
            await uploadServiceFactory.createService('gcp-storage', {
                bucketName: preferences.gcpBucket,
                serviceAccountKey: preferences.gcpServiceAccountKey
            });
            
            // Test the connection
            const result = await uploadServiceFactory.testService('gcp-storage');
            
            if (!result.success) {
                throw new Error(result.message);
            }

            // Success state with checkmark and animation
            if (testBtn && testIcon && testText) {
                // Stop spinning
                testIcon.classList.remove('animate-spin');
                
                // Success colors and icon
                testBtn.classList.remove('bg-red-600');
                testBtn.classList.add('bg-green-500');
                
                // Checkmark icon with scale animation
                testIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                `;
                testIcon.classList.add('animate-pulse');
                testText.textContent = 'Connection Successful!';
                
                // Add a subtle scale animation to the button
                testBtn.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    testBtn.style.transform = 'scale(1)';
                }, 200);
                
                // Keep button disabled in success state
                testBtn.disabled = true;
                this.gcpConnectionTested = true;
                
                // Show success notification
                UIComponents.Notification.show('GCP Cloud Storage connection test successful! 🎉', 'success');
            }
            
        } catch (error) {
            console.error('GCP connection test failed:', error);
            
            // Error state
            if (testBtn && testIcon && testText) {
                testIcon.classList.remove('animate-spin');
                testBtn.classList.remove('bg-red-600');
                testBtn.classList.add('bg-red-700');
                
                // Error icon
                testIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                `;
                testText.textContent = 'Connection Failed';
                
                // Shake animation for error
                testBtn.style.animation = 'shake 0.5s ease-in-out';
                setTimeout(() => {
                    testBtn.style.animation = '';
                }, 500);
                
                // Reset to initial state after 3 seconds
                setTimeout(() => {
                    this.resetGcpTestButton();
                }, 3000);
            }
            
            UIComponents.Notification.show(`GCP Cloud Storage connection test failed: ${error.message}`, 'error');
        }
    }

    /**
     * Reset GCP test button to initial state
     */
    resetGcpTestButton() {
        const testBtn = document.getElementById('testGcpConnectionBtn');
        const testIcon = document.getElementById('testGcpIcon');
        const testText = document.getElementById('testGcpText');
        
        if (testBtn && testIcon && testText) {
            // Reset button state
            testBtn.disabled = false;
            testBtn.classList.remove('bg-red-600', 'bg-green-500', 'bg-red-700');
            testBtn.classList.add('bg-red-500', 'hover:bg-red-600');
            
            // Reset icon
            testIcon.classList.remove('animate-spin', 'animate-pulse');
            testIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            `;
            
            // Reset text
            testText.textContent = 'Test Connection';
            
            // Reset transform and animation
            testBtn.style.transform = '';
            testBtn.style.animation = '';
            
            this.gcpConnectionTested = false;
        }
    }

    /**
     * Create secure input fields for AWS S3
     */
    createAwsS3SecureInputs() {
        const accessKeyContainer = document.getElementById('awsS3AccessKeyContainer');
        const secretKeyContainer = document.getElementById('awsS3SecretKeyContainer');

        if (accessKeyContainer) {
            const accessKeyInput = UIComponents.SecureInput.create({
                id: 'awsS3AccessKey',
                label: 'Access Key ID',
                placeholder: 'AKIAIOSFODNN7EXAMPLE',
                required: true
            });
            accessKeyContainer.appendChild(accessKeyInput);

            // Add event listener for access key changes
            const accessKeyField = document.getElementById('awsS3AccessKey');
            if (accessKeyField) {
                accessKeyField.addEventListener('input', (e) => {
                    this.updatePreference('awsS3AccessKey', e.target.value);
                    this.resetS3TestButton();
                });
            }
        }

        if (secretKeyContainer) {
            const secretKeyInput = UIComponents.SecureInput.create({
                id: 'awsS3SecretKey',
                label: 'Secret Access Key',
                placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
                required: true
            });
            secretKeyContainer.appendChild(secretKeyInput);

            // Add event listener for secret key changes
            const secretKeyField = document.getElementById('awsS3SecretKey');
            if (secretKeyField) {
                secretKeyField.addEventListener('input', (e) => {
                    this.updatePreference('awsS3SecretKey', e.target.value);
                    this.resetS3TestButton();
                });
            }
        }

        // Load AWS regions after creating the inputs
        this.loadAwsRegions();
    }

    /**
     * Fetch and populate AWS regions from public endpoint
     */
    async loadAwsRegions() {
        const regionSelect = document.getElementById('awsS3Region');
        if (!regionSelect) return;

        try {
            // Use AWS's public endpoint to get regions
            // This endpoint provides region information without requiring authentication
            const response = await fetch('https://ip-ranges.amazonaws.com/ip-ranges.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Extract unique regions from the IP ranges data
            const regions = new Set();
            data.prefixes.forEach(prefix => {
                if (prefix.region && prefix.service === 'S3') {
                    regions.add(prefix.region);
                }
            });

            // Convert to array and sort
            const sortedRegions = Array.from(regions).sort();

            // Clear loading option
            regionSelect.innerHTML = '<option value="">Select a region</option>';

            // Add regions to dropdown
            sortedRegions.forEach(region => {
                const option = document.createElement('option');
                option.value = region;
                option.textContent = `${region}`;
                regionSelect.appendChild(option);
            });

            // Restore saved preference if any
            const preferences = this.getPreferences();
            if (preferences.awsS3Region) {
                regionSelect.value = preferences.awsS3Region;
            }

            console.log(`Loaded ${sortedRegions.length} AWS regions`);

        } catch (error) {
            console.error('Failed to load AWS regions:', error);
            
            // Fallback to a basic list of common regions
            const fallbackRegions = [
                { code: 'us-east-1', name: 'US East (N. Virginia)' },
                { code: 'us-east-2', name: 'US East (Ohio)' },
                { code: 'us-west-1', name: 'US West (N. California)' },
                { code: 'us-west-2', name: 'US West (Oregon)' },
                { code: 'eu-west-1', name: 'Europe (Ireland)' },
                { code: 'eu-west-2', name: 'Europe (London)' },
                { code: 'eu-central-1', name: 'Europe (Frankfurt)' },
                { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
                { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
                { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' }
            ];

            regionSelect.innerHTML = '<option value="">Select a region</option>';
            fallbackRegions.forEach(region => {
                const option = document.createElement('option');
                option.value = region.code;
                option.textContent = `${region.name} - ${region.code}`;
                regionSelect.appendChild(option);
            });

            // Restore saved preference if any
            const preferences = this.getPreferences();
            if (preferences.awsS3Region) {
                regionSelect.value = preferences.awsS3Region;
            }

            UIComponents.Notification.show('Using fallback region list. Check your internet connection.', 'warning');
        }
    }

    /**
     * Get human-readable display name for AWS region
     * @param {string} regionCode - AWS region code
     * @returns {string} Human-readable region name
     */
    getRegionDisplayName(regionCode) {
        const regionNames = {
            'us-east-1': 'US East (N. Virginia)',
            'us-east-2': 'US East (Ohio)',
            'us-west-1': 'US West (N. California)',
            'us-west-2': 'US West (Oregon)',
            'ca-central-1': 'Canada (Central)',
            'eu-north-1': 'Europe (Stockholm)',
            'eu-west-1': 'Europe (Ireland)',
            'eu-west-2': 'Europe (London)',
            'eu-west-3': 'Europe (Paris)',
            'eu-central-1': 'Europe (Frankfurt)',
            'eu-south-1': 'Europe (Milan)',
            'ap-northeast-1': 'Asia Pacific (Tokyo)',
            'ap-northeast-2': 'Asia Pacific (Seoul)',
            'ap-northeast-3': 'Asia Pacific (Osaka)',
            'ap-southeast-1': 'Asia Pacific (Singapore)',
            'ap-southeast-2': 'Asia Pacific (Sydney)',
            'ap-southeast-3': 'Asia Pacific (Jakarta)',
            'ap-south-1': 'Asia Pacific (Mumbai)',
            'ap-east-1': 'Asia Pacific (Hong Kong)',
            'me-south-1': 'Middle East (Bahrain)',
            'af-south-1': 'Africa (Cape Town)',
            'sa-east-1': 'South America (São Paulo)',
            'us-gov-east-1': 'AWS GovCloud (US-East)',
            'us-gov-west-1': 'AWS GovCloud (US-West)'
        };

        return regionNames[regionCode] || regionCode.toUpperCase().replace(/-/g, ' ');
    }

    /**
     * Test AWS S3 connection with enhanced animations and feedback
     */
    async testS3Connection() {
        const testBtn = document.getElementById('testS3ConnectionBtn');
        const testIcon = document.getElementById('testS3Icon');
        const testText = document.getElementById('testS3Text');
        const preferences = this.getPreferences();

        // Validate required fields
        if (!preferences.awsS3Region || !preferences.awsS3Bucket || !preferences.awsS3AccessKey || !preferences.awsS3SecretKey) {
            UIComponents.Notification.show('Please fill in all required AWS S3 fields.', 'warning');
            return;
        }

        // Disable button and start loading animation
        if (testBtn && testIcon && testText) {
            testBtn.disabled = true;
            testBtn.classList.remove('bg-orange-500', 'hover:bg-orange-600');
            testBtn.classList.add('bg-blue-500');
            
            // Loading state with spinning icon
            testIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            `;
            testIcon.classList.add('animate-spin');
            testText.textContent = 'Testing Connection...';
        }

        try {
            // Import upload service factory
            const { uploadServiceFactory } = await import('../upload/upload-service-factory.js');
            
            // Create service with current settings
            await uploadServiceFactory.createService('aws-s3', {
                region: preferences.awsS3Region,
                bucket: preferences.awsS3Bucket,
                accessKey: preferences.awsS3AccessKey,
                secretKey: preferences.awsS3SecretKey,
                storageClass: preferences.awsS3StorageTier || 'STANDARD'
            });
            
            // Test the connection
            const result = await uploadServiceFactory.testService('aws-s3');
            
            if (!result.success) {
                throw new Error(result.message);
            }

            // Success state with checkmark and animation
            if (testBtn && testIcon && testText) {
                // Stop spinning
                testIcon.classList.remove('animate-spin');
                
                // Success colors and icon
                testBtn.classList.remove('bg-blue-500');
                testBtn.classList.add('bg-green-500');
                
                // Checkmark icon with scale animation
                testIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                `;
                testIcon.classList.add('animate-pulse');
                testText.textContent = 'Connection Successful!';
                
                // Add a subtle scale animation to the button
                testBtn.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    testBtn.style.transform = 'scale(1)';
                }, 200);
                
                // Keep button disabled in success state
                testBtn.disabled = true;
                this.s3ConnectionTested = true;
                
                // Show success notification
                UIComponents.Notification.show('AWS S3 connection test successful! 🎉', 'success');
            }
            
        } catch (error) {
            console.error('S3 connection test failed:', error);
            
            // Error state
            if (testBtn && testIcon && testText) {
                testIcon.classList.remove('animate-spin');
                testBtn.classList.remove('bg-blue-500');
                testBtn.classList.add('bg-red-500');
                
                // Error icon
                testIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                `;
                testText.textContent = 'Connection Failed';
                
                // Shake animation for error
                testBtn.style.animation = 'shake 0.5s ease-in-out';
                setTimeout(() => {
                    testBtn.style.animation = '';
                }, 500);
                
                // Reset to initial state after 3 seconds
                setTimeout(() => {
                    this.resetS3TestButton();
                }, 3000);
            }
            
            UIComponents.Notification.show(`AWS S3 connection test failed: ${error.message}`, 'error');
        }
    }

    /**
     * Reset S3 test button to initial state
     */
    resetS3TestButton() {
        const testBtn = document.getElementById('testS3ConnectionBtn');
        const testIcon = document.getElementById('testS3Icon');
        const testText = document.getElementById('testS3Text');
        
        if (testBtn && testIcon && testText) {
            // Reset button state
            testBtn.disabled = false;
            testBtn.classList.remove('bg-blue-500', 'bg-green-500', 'bg-red-500');
            testBtn.classList.add('bg-orange-500', 'hover:bg-orange-600');
            
            // Reset icon
            testIcon.classList.remove('animate-spin', 'animate-pulse');
            testIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            `;
            
            // Reset text
            testText.textContent = 'Test Connection';
            
            // Reset transform and animation
            testBtn.style.transform = '';
            testBtn.style.animation = '';
            
            this.s3ConnectionTested = false;
        }
    }

    /**
     * Test Azure Blob Storage connection with enhanced animations and feedback
     */
    async testAzureConnection() {
        const testBtn = document.getElementById('testAzureConnectionBtn');
        const testIcon = document.getElementById('testAzureIcon');
        const testText = document.getElementById('testAzureText');
        const preferences = this.getPreferences();

        // Validate required fields
        if (!preferences.azureContainer || !preferences.azureConnectionString) {
            UIComponents.Notification.show('Please fill in all required Azure fields.', 'warning');
            return;
        }

        // Disable button and start loading animation
        if (testBtn && testIcon && testText) {
            testBtn.disabled = true;
            testBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            testBtn.classList.add('bg-blue-600');
            
            // Loading state with spinning icon
            testIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            `;
            testIcon.classList.add('animate-spin');
            testText.textContent = 'Testing Connection...';
        }

        try {
            // Import upload service factory
            const { uploadServiceFactory } = await import('../upload/upload-service-factory.js');
            
            // Create service with current settings
            await uploadServiceFactory.createService('azure-blob', {
                connectionString: preferences.azureConnectionString,
                containerName: preferences.azureContainer
            });
            
            // Test the connection
            const result = await uploadServiceFactory.testService('azure-blob');
            
            if (!result.success) {
                throw new Error(result.message);
            }

            // Success state with checkmark and animation
            if (testBtn && testIcon && testText) {
                // Stop spinning
                testIcon.classList.remove('animate-spin');
                
                // Success colors and icon
                testBtn.classList.remove('bg-blue-600');
                testBtn.classList.add('bg-green-500');
                
                // Checkmark icon with scale animation
                testIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                `;
                testIcon.classList.add('animate-pulse');
                testText.textContent = 'Connection Successful!';
                
                // Add a subtle scale animation to the button
                testBtn.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    testBtn.style.transform = 'scale(1)';
                }, 200);
                
                // Keep button disabled in success state
                testBtn.disabled = true;
                this.azureConnectionTested = true;
                
                // Show success notification
                UIComponents.Notification.show('Azure Blob Storage connection test successful! 🎉', 'success');
            }
            
        } catch (error) {
            console.error('Azure connection test failed:', error);
            
            // Error state
            if (testBtn && testIcon && testText) {
                testIcon.classList.remove('animate-spin');
                testBtn.classList.remove('bg-blue-600');
                testBtn.classList.add('bg-red-500');
                
                // Error icon
                testIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                `;
                testText.textContent = 'Connection Failed';
                
                // Shake animation for error
                testBtn.style.animation = 'shake 0.5s ease-in-out';
                setTimeout(() => {
                    testBtn.style.animation = '';
                }, 500);
                
                // Reset to initial state after 3 seconds
                setTimeout(() => {
                    this.resetAzureTestButton();
                }, 3000);
            }
            
            UIComponents.Notification.show(`Azure Blob Storage connection test failed: ${error.message}`, 'error');
        }
    }

    /**
     * Reset Azure test button to initial state
     */
    resetAzureTestButton() {
        const testBtn = document.getElementById('testAzureConnectionBtn');
        const testIcon = document.getElementById('testAzureIcon');
        const testText = document.getElementById('testAzureText');
        
        if (testBtn && testIcon && testText) {
            // Reset button state
            testBtn.disabled = false;
            testBtn.classList.remove('bg-blue-600', 'bg-green-500', 'bg-red-500');
            testBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            
            // Reset icon
            testIcon.classList.remove('animate-spin', 'animate-pulse');
            testIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            `;
            
            // Reset text
            testText.textContent = 'Test Connection';
            
            // Reset transform and animation
            testBtn.style.transform = '';
            testBtn.style.animation = '';
            
            this.azureConnectionTested = false;
        }
    }

    /**
     * Test AWS S3 connection by attempting to access bucket
     * @param {string} region - AWS region
     * @param {string} bucket - S3 bucket name
     * @param {string} accessKey - AWS access key
     * @param {string} secretKey - AWS secret key
     */
    async testAwsS3Connection(region, bucket, accessKey, secretKey) {
        // Basic validation first
        if (!region || !bucket || !accessKey || !secretKey) {
            throw new Error('All AWS S3 fields are required');
        }
        
        if (!accessKey.startsWith('AKIA') && !accessKey.startsWith('ASIA')) {
            throw new Error('Invalid AWS Access Key format');
        }
        
        if (secretKey.length < 40) {
            throw new Error('AWS Secret Key appears to be too short');
        }
        
        // Test bucket accessibility with a simple HEAD request
        // This will fail with 403 if credentials are wrong, or 404 if bucket doesn't exist
        const endpoint = `https://${bucket}.s3.${region}.amazonaws.com/`;
        
        try {
            const response = await fetch(endpoint, {
                method: 'HEAD',
                mode: 'no-cors' // This will limit what we can see, but will still test connectivity
            });
            
            // With no-cors mode, we can't read the response status directly
            // But if the request completes without throwing, the endpoint is reachable
            console.log('S3 endpoint is reachable');
            
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('Cannot reach S3 endpoint. Check region and bucket name.');
            }
            throw error;
        }
        
        // Additional validation: try to validate the region format
        const validRegionPattern = /^[a-z0-9-]+$/;
        if (!validRegionPattern.test(region)) {
            throw new Error('Invalid AWS region format');
        }
        
        // Additional validation: bucket name format
        const validBucketPattern = /^[a-z0-9.-]+$/;
        if (!validBucketPattern.test(bucket) || bucket.length < 3 || bucket.length > 63) {
            throw new Error('Invalid S3 bucket name format');
        }
    }

    /**
     * Test Azure Blob Storage connection by validating connection string and testing endpoint
     * @param {string} connectionString - Azure storage connection string
     * @param {string} containerName - Container name
     */
    async testAzureBlobConnection(connectionString, containerName) {
        // Basic validation first
        if (!connectionString || !containerName) {
            throw new Error('Azure connection string and container name are required');
        }
        
        // Parse connection string
        const connectionParams = this.parseAzureConnectionString(connectionString);
        if (!connectionParams.accountName || !connectionParams.accountKey) {
            throw new Error('Invalid Azure connection string - missing AccountName or AccountKey');
        }
        
        const { accountName, accountKey } = connectionParams;
        
        // Validate account name format
        const validAccountPattern = /^[a-z0-9]+$/;
        if (!validAccountPattern.test(accountName) || accountName.length < 3 || accountName.length > 24) {
            throw new Error('Invalid Azure storage account name format');
        }
        
        // Validate container name format
        const validContainerPattern = /^[a-z0-9-]+$/;
        if (!validContainerPattern.test(containerName) || containerName.length < 3 || containerName.length > 63) {
            throw new Error('Invalid Azure container name format');
        }
        
        // Validate account key format (should be base64)
        try {
            atob(accountKey);
        } catch (error) {
            throw new Error('Invalid Azure account key format - must be base64 encoded');
        }
        
        // Test endpoint accessibility
        const endpoint = `https://${accountName}.blob.core.windows.net/${containerName}`;
        
        try {
            const response = await fetch(endpoint, {
                method: 'HEAD',
                mode: 'no-cors'
            });
            
            console.log('Azure endpoint is reachable');
            
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('Cannot reach Azure endpoint. Check account name and container name.');
            }
            throw error;
        }
    }

    /**
     * Test GCP Cloud Storage connection by validating service account key and testing endpoint
     * @param {string} serviceAccountKey - GCP service account key JSON
     * @param {string} bucketName - GCS bucket name
     */
    async testGcpCloudStorageConnection(serviceAccountKey, bucketName) {
        // Basic validation first
        if (!serviceAccountKey || !bucketName) {
            throw new Error('GCP service account key and bucket name are required');
        }
        
        let keyData;
        try {
            keyData = JSON.parse(serviceAccountKey);
        } catch (error) {
            throw new Error('Invalid JSON in service account key');
        }
        
        // Validate required fields in service account key
        const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'universe_domain'];
        const missingFields = requiredFields.filter(field => !keyData[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Service account key missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Validate service account type
        if (keyData.type !== 'service_account') {
            throw new Error('Invalid service account key type - must be "service_account"');
        }
        
        // Validate email format
        const emailPattern = /^[^@]+@[^@]+\.iam\.gserviceaccount\.com$/;
        if (!emailPattern.test(keyData.client_email)) {
            throw new Error('Invalid service account email format');
        }
        
        // Validate bucket name format
        const validBucketPattern = /^[a-z0-9._-]+$/;
        if (!validBucketPattern.test(bucketName) || bucketName.length < 3 || bucketName.length > 63) {
            throw new Error('Invalid GCS bucket name format');
        }
        
        // Validate private key format
        if (!keyData.private_key.includes('BEGIN PRIVATE KEY') || !keyData.private_key.includes('END PRIVATE KEY')) {
            throw new Error('Invalid private key format in service account key');
        }
        
        // Test endpoint accessibility (public endpoint, no auth needed for basic connectivity test)
        const endpoint = `https://storage.googleapis.com/storage/v1/b/${bucketName}`;
        
        try {
            const response = await fetch(endpoint, {
                method: 'HEAD',
                mode: 'no-cors'
            });
            
            console.log('GCP endpoint is reachable');
            
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('Cannot reach GCP endpoint. Check bucket name and internet connectivity.');
            }
            throw error;
        }
        
        // Additional validation: check project ID format
        const validProjectPattern = /^[a-z][a-z0-9-]*[a-z0-9]$/;
        if (!validProjectPattern.test(keyData.project_id)) {
            throw new Error('Invalid GCP project ID format');
        }
    }

    /**
     * Parse Azure connection string
     * @param {string} connectionString - Azure storage connection string
     * @returns {Object} Parsed connection parameters
     */
    parseAzureConnectionString(connectionString) {
        const params = {};
        const parts = connectionString.split(';');
        
        for (const part of parts) {
            const [key, value] = part.split('=');
            if (key && value) {
                params[key] = value;
            }
        }
        
        return {
            accountName: params.AccountName,
            accountKey: params.AccountKey,
            endpointSuffix: params.EndpointSuffix || 'core.windows.net'
        };
    }


} 