/**
 * Upload Service Factory (Renderer Process)
 * Communicates with the main process upload service manager via IPC
 */

// IPC communication now handled through window.electronAPI

import { ConfigurationBridge } from '../bridges/ConfigurationBridge.js';

export class CloudFacade {
    constructor(serviceType) {
        this.serviceType = serviceType;
    }

    async testService() {
        window.logger.warn('CloudFacade: testService not implemented');
        return true;
        /* const result = await window.electronAPI.uploadService.test(this.serviceType);
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.result; */
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
        const configBridge = new ConfigurationBridge();
        return configBridge.getServiceDisplayInfo(this.serviceType);
    }
}

// Create a singleton instance for global use
export const uploadServiceFactory = new CloudFacade(); 