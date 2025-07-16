/**
 * Cloud Service Facade (React Renderer Process)
 * Communicates with the main process cloud services via IPC
 */

import type { 
  CloudServiceType, 
  ServiceDisplayInfo, 
  ServiceWithDisplayInfo, 
  CloudServiceSettings 
} from '../types/cloud';

export class CloudFacade {
  private readonly serviceType: CloudServiceType;

  constructor(serviceType: CloudServiceType) {
    this.serviceType = serviceType;
  }

  public async testService(): Promise<boolean> {
    console.warn('CloudFacade: testService not implemented');
    return true;
  }

  public async getSettings(serviceType: CloudServiceType): Promise<CloudServiceSettings> {
    const result = await window.electronAPI.config.getCloudSettings(serviceType);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get cloud settings');
    }
    return result.settings || {};
  }

  public async updateSettings(
    serviceType: CloudServiceType, 
    newSettings: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const result = await window.electronAPI.config.updateCloudSettings(serviceType, newSettings);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update cloud settings');
    }
    return result.serviceInfo || {};
  }

  public async getDisplayInfo(): Promise<ServiceDisplayInfo | undefined> {
    return this.getServiceDisplayInfo(this.serviceType);
  }

  public async getServiceDisplayInfo(serviceType: CloudServiceType): Promise<ServiceDisplayInfo | undefined> {
    const serviceTypes = await window.electronAPI.clouds.getServices();

    if (!serviceTypes.includes(serviceType)) {
      throw new Error(`Invalid service type: ${serviceType}`);
    }

    const displayInfo: Record<CloudServiceType, ServiceDisplayInfo> = {
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

  public static async getEnabledServicesWithDisplayInfo(): Promise<ReadonlyArray<ServiceWithDisplayInfo>> {
    try {
      const enabledServices = await window.electronAPI.clouds.getEnabledServices();
      console.log('Enabled services:', enabledServices);
      const servicesWithInfo: ServiceWithDisplayInfo[] = [];

      for (const service of enabledServices) {
        const facade = new CloudFacade(service.serviceType);
        const displayInfo = await facade.getDisplayInfo();
        if (displayInfo) {
          servicesWithInfo.push({
            type: service.serviceType,
            ...displayInfo
          });
        }
      }

      return servicesWithInfo;
    } catch (error) {
      console.error('Failed to get enabled services with display info:', error);
      return [];
    }
  }
}

// Create a singleton instance for global use
export const cloudServiceFactory = new CloudFacade('zentransfer'); 