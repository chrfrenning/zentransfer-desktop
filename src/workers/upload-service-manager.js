/**
 * Upload Service Manager (Main Process)
 * Manages upload services and exposes functionality to renderer via IPC
 */

const { ZenTransferService } = require('./services/zentransfer-service.js');
const { AwsS3Service } = require('./services/aws-s3-service.js');
const { AzureBlobService } = require('./services/azure-blob-service.js');
const { GcpStorageService } = require('./services/gcp-storage-service.js');

class UploadServiceManager {
    constructor() {
        this.services = new Map();
        this.serviceTypes = {
            'zentransfer': ZenTransferService,
            'aws-s3': AwsS3Service,
            'azure-blob': AzureBlobService,
            'gcp-storage': GcpStorageService
        };
    }

    /**
     * Create or update a service instance
     * @param {string} serviceType - Type of service
     * @param {Object} settings - Service settings
     * @returns {Object} Service info
     */
    createService(serviceType, settings = {}) {
        if (!this.serviceTypes[serviceType]) {
            throw new Error(`Unknown service type: ${serviceType}`);
        }

        const ServiceClass = this.serviceTypes[serviceType];
        const service = new ServiceClass(settings);
        
        this.services.set(serviceType, service);
        
        return {
            type: serviceType,
            name: service.getServiceName(),
            configured: service.isServiceConfigured()
        };
    }

    /**
     * Test connection for a service
     * @param {string} serviceType - Type of service
     * @returns {Promise<Object>} Test result
     */
    async testService(serviceType) {
        const service = this.services.get(serviceType);
        if (!service) {
            return {
                success: false,
                message: `Service not found: ${serviceType}`
            };
        }

        return await service.testConnection();
    }

    /**
     * Update service settings
     * @param {string} serviceType - Type of service
     * @param {Object} newSettings - New settings
     * @returns {Object} Updated service info
     */
    updateService(serviceType, newSettings) {
        const service = this.services.get(serviceType);
        if (!service) {
            throw new Error(`Service not found: ${serviceType}`);
        }

        service.updateSettings(newSettings);
        
        return {
            type: serviceType,
            name: service.getServiceName(),
            configured: service.isServiceConfigured()
        };
    }

    /**
     * Get service display information
     * @param {string} serviceType - Type of service
     * @returns {Object} Service display info
     */
    getServiceDisplayInfo(serviceType) {
        const displayInfo = {
            'zentransfer': {
                name: 'ZenTransfer',
                description: 'Upload to ZenTransfer platform',
                icon: '🚀',
                color: 'blue'
            },
            'aws-s3': {
                name: 'AWS S3',
                description: 'Upload to Amazon S3',
                icon: '☁️',
                color: 'orange'
            },
            'azure-blob': {
                name: 'Azure Blob Storage',
                description: 'Upload to Microsoft Azure',
                icon: '☁️',
                color: 'blue'
            },
            'gcp-storage': {
                name: 'Google Cloud Storage',
                description: 'Upload to Google Cloud',
                icon: '☁️',
                color: 'red'
            }
        };

        return displayInfo[serviceType] || {
            name: serviceType,
            description: 'Unknown service',
            icon: '❓',
            color: 'gray'
        };
    }

    /**
     * Create services from user preferences
     * @param {Object} preferences - User preferences object
     * @returns {Array<Object>} Array of created service info
     */
    createServicesFromPreferences(preferences) {
        const createdServices = [];

        // ZenTransfer (available if token exists)
        if (preferences.token) {
            const serviceInfo = this.createService('zentransfer', {
                token: preferences.token,
                apiBaseUrl: preferences.apiBaseUrl,
                appName: preferences.appName,
                appVersion: preferences.appVersion,
                clientId: preferences.clientId
            });
            createdServices.push(serviceInfo);
        }

        // AWS S3
        if (preferences.awsS3Enabled && preferences.awsS3Region && preferences.awsS3Bucket) {
            const serviceInfo = this.createService('aws-s3', {
                region: preferences.awsS3Region,
                bucket: preferences.awsS3Bucket,
                accessKey: preferences.awsS3AccessKey,
                secretKey: preferences.awsS3SecretKey,
                storageClass: preferences.awsS3StorageTier || 'STANDARD'
            });
            createdServices.push(serviceInfo);
        }

        // Azure Blob Storage
        if (preferences.azureEnabled && preferences.azureContainer && preferences.azureConnectionString) {
            const serviceInfo = this.createService('azure-blob', {
                connectionString: preferences.azureConnectionString,
                containerName: preferences.azureContainer
            });
            createdServices.push(serviceInfo);
        }

        // GCP Cloud Storage
        if (preferences.gcpEnabled && preferences.gcpBucket && preferences.gcpServiceAccountKey) {
            const serviceInfo = this.createService('gcp-storage', {
                bucketName: preferences.gcpBucket,
                serviceAccountKey: preferences.gcpServiceAccountKey
            });
            createdServices.push(serviceInfo);
        }

        return createdServices;
    }

    /**
     * Get all configured services
     * @returns {Array<Object>} Array of service info
     */
    getAllServices() {
        const serviceList = [];
        
        for (const [type, service] of this.services) {
            serviceList.push({
                type,
                name: service.getServiceName(),
                configured: service.isServiceConfigured(),
                lastTest: service.getLastTestResult(),
                displayInfo: this.getServiceDisplayInfo(type)
            });
        }
        
        return serviceList;
    }

    /**
     * Remove a service
     * @param {string} serviceType - Type of service to remove
     * @returns {boolean} True if removed
     */
    removeService(serviceType) {
        return this.services.delete(serviceType);
    }

    /**
     * Clear all services
     */
    clearAllServices() {
        this.services.clear();
    }
}

module.exports = { UploadServiceManager }; 