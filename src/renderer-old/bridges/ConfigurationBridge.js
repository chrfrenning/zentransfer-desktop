/**
 * Authentication Manager
 * Handles login, token management, and user session
 */

export class ConfigurationBridge {
    constructor() {
    }

    async get(section) {
        return window.electronAPI.config.get(section);
    }

    async set(section, value) {
        return window.electronAPI.config.set(section, value);
    }

    async getServiceDisplayInfo(serviceType) {
        let serviceTypes = await window.electronAPI.clouds.getServices();

        if ( !serviceTypes.includes(serviceType) ) {
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
}