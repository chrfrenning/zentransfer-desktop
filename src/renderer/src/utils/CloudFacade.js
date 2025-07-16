/**
 * Cloud Service Facade (React Renderer Process)
 * Communicates with the main process cloud services via IPC
 */

export class CloudFacade {
    constructor(serviceType) {
        this.serviceType = serviceType;
    }

    async testService() {
        console.warn('CloudFacade: testService not implemented');
        return true;
    }

    async getSettings(serviceType) {
        const result = await window.electronAPI.config.getCloudSettings(serviceType);
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.settings;
    }

    async updateSettings(serviceType, newSettings) {
        const result = await window.electronAPI.config.updateCloudSettings(serviceType, newSettings);
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.serviceInfo;
    }

    async getDisplayInfo() {
        return this.getServiceDisplayInfo(this.serviceType);
    }

    async getServiceDisplayInfo(serviceType) {
        const serviceTypes = await window.electronAPI.clouds.getServices();

        if (!serviceTypes.includes(serviceType)) {
            throw new Error(`Invalid service type: ${serviceType}`);
        }

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
            },
            'minio': {
                name: 'MinIO',
                description: 'Upload to MinIO (S3-compatible)',
                icon: '☁️',
                color: 'purple'
            }
        };

        return displayInfo[serviceType];
    }

    static async getEnabledServicesWithDisplayInfo() {
        try {
            const enabledServices = await window.electronAPI.clouds.getEnabledServices();
            console.log('Enabled services:', enabledServices);
            const servicesWithInfo = [];

            for (const service of enabledServices) {
                const facade = new CloudFacade(service.serviceType);
                const displayInfo = await facade.getDisplayInfo();
                servicesWithInfo.push({
                    type: service.serviceType,
                    ...displayInfo
                });
            }

            return servicesWithInfo;
        } catch (error) {
            console.error('Failed to get enabled services with display info:', error);
            return [];
        }
    }
}

// Create a singleton instance for global use
export const cloudServiceFactory = new CloudFacade(); 