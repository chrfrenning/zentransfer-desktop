import React, { useState, useEffect } from 'react';
import { Checkbox } from '../catalyst/checkbox';
import { Switch } from '../catalyst/switch';
import { CloudFacade } from '../../utils/CloudFacade';
import { getElectronAPI } from '../../api/ZenTransferAPI';
import type { ServiceWithDisplayInfo } from '../../types/cloud';

interface CloudServiceSelectorProps {
  enableCloudUpload: boolean;
  onEnableCloudUploadChange: (enabled: boolean) => void;
  uploadToZenTransfer: boolean;
  uploadToAwsS3: boolean;
  uploadToAzure: boolean;
  uploadToGcp: boolean;
  uploadToMinio: boolean;
  onServiceChange: (service: string, enabled: boolean) => void;
  disabled?: boolean;
}

interface ServiceAvailability {
  zentransfer: boolean;
  'aws-s3': boolean;
  'azure-blob': boolean;
  'gcp-storage': boolean;
  minio: boolean;
}

const CloudServiceSelector: React.FC<CloudServiceSelectorProps> = ({
  enableCloudUpload,
  onEnableCloudUploadChange,
  uploadToZenTransfer,
  uploadToAwsS3,
  uploadToAzure,
  uploadToGcp,
  uploadToMinio,
  onServiceChange,
  disabled = false
}) => {
  const [availableServices, setAvailableServices] = useState<ServiceWithDisplayInfo[]>([]);
  const [serviceAvailability, setServiceAvailability] = useState<ServiceAvailability>({
    zentransfer: false,
    'aws-s3': false,
    'azure-blob': false,
    'gcp-storage': false,
    minio: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServiceAvailability();
  }, []);

  const loadServiceAvailability = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Get enabled services with display info
      const services = await CloudFacade.getEnabledServicesWithDisplayInfo();
      setAvailableServices([...services]);
      
      // Check individual service availability
      const availability: ServiceAvailability = {
        zentransfer: false,
        'aws-s3': false,
        'azure-blob': false,
        'gcp-storage': false,
        minio: false
      };

      // Check ZenTransfer authentication
      try {
        const api = getElectronAPI();
        const hasValidToken = await api.auth.hasValidToken();
        availability.zentransfer = hasValidToken;
      } catch (error) {
        console.warn('Failed to check ZenTransfer authentication:', error);
      }

      // Check cloud service configurations
      for (const service of services) {
        if (service.type !== 'zentransfer') {
          availability[service.type] = true; // If it's in the enabled list, it should be configured
        }
      }

      setServiceAvailability(availability);
    } catch (error) {
      console.error('Failed to load service availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceCheckboxState = (serviceType: string): boolean => {
    switch (serviceType) {
      case 'zentransfer': return uploadToZenTransfer;
      case 'aws-s3': return uploadToAwsS3;
      case 'azure-blob': return uploadToAzure;
      case 'gcp-storage': return uploadToGcp;
      case 'minio': return uploadToMinio;
      default: return false;
    }
  };

  const getServiceAvailability = (serviceType: string): boolean => {
    return serviceAvailability[serviceType as keyof ServiceAvailability] || false;
  };

  const getUnavailableMessage = (serviceType: string): string => {
    switch (serviceType) {
      case 'zentransfer':
        return 'Please log in to enable ZenTransfer uploads';
      case 'aws-s3':
        return 'Please enable and configure AWS S3 in Settings';
      case 'azure-blob':
        return 'Please enable and configure Azure Blob Storage in Settings';
      case 'gcp-storage':
        return 'Please enable and configure Google Cloud Storage in Settings';
      case 'minio':
        return 'Please enable and configure MinIO in Settings';
      default:
        return 'Service not available';
    }
  };

  const handleServiceToggle = (serviceType: string, enabled: boolean): void => {
    onServiceChange(serviceType, enabled);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <div className="animate-pulse">
            <div className="h-6 w-6 bg-gray-200 rounded"></div>
          </div>
          <span className="text-sm text-gray-500">Loading cloud services...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Master toggle for cloud upload */}
      <div className="flex items-center space-x-3">
        <Switch
          checked={enableCloudUpload}
          onChange={onEnableCloudUploadChange}
          disabled={disabled}
        />
        <label className="text-sm font-medium text-gray-700 cursor-pointer">
          Upload to cloud
        </label>
      </div>

      {/* Individual service toggles */}
      {enableCloudUpload && (
        <div className="ml-7 space-y-3">
          {/* ZenTransfer */}
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={uploadToZenTransfer}
              onChange={(checked) => handleServiceToggle('zentransfer', checked)}
              disabled={disabled || !getServiceAvailability('zentransfer')}
            />
            <label className={`text-sm font-medium cursor-pointer ${
              !getServiceAvailability('zentransfer') ? 'text-gray-400' : 'text-gray-700'
            }`}>
              🚀 Relay with ZenTransfer.io
            </label>
          </div>

          {/* AWS S3 */}
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={uploadToAwsS3}
              onChange={(checked) => handleServiceToggle('aws-s3', checked)}
              disabled={disabled || !getServiceAvailability('aws-s3')}
            />
            <label className={`text-sm font-medium cursor-pointer ${
              !getServiceAvailability('aws-s3') ? 'text-gray-400' : 'text-gray-700'
            }`}>
              ☁️ Upload to AWS S3
            </label>
          </div>

          {/* Azure Blob Storage */}
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={uploadToAzure}
              onChange={(checked) => handleServiceToggle('azure-blob', checked)}
              disabled={disabled || !getServiceAvailability('azure-blob')}
            />
            <label className={`text-sm font-medium cursor-pointer ${
              !getServiceAvailability('azure-blob') ? 'text-gray-400' : 'text-gray-700'
            }`}>
              ☁️ Upload to Azure Blob Storage
            </label>
          </div>

          {/* Google Cloud Storage */}
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={uploadToGcp}
              onChange={(checked) => handleServiceToggle('gcp-storage', checked)}
              disabled={disabled || !getServiceAvailability('gcp-storage')}
            />
            <label className={`text-sm font-medium cursor-pointer ${
              !getServiceAvailability('gcp-storage') ? 'text-gray-400' : 'text-gray-700'
            }`}>
              ☁️ Upload to Google Cloud Storage
            </label>
          </div>

          {/* MinIO */}
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={uploadToMinio}
              onChange={(checked) => handleServiceToggle('minio', checked)}
              disabled={disabled || !getServiceAvailability('minio')}
            />
            <label className={`text-sm font-medium cursor-pointer ${
              !getServiceAvailability('minio') ? 'text-gray-400' : 'text-gray-700'
            }`}>
              ☁️ Upload to MinIO
            </label>
          </div>

          {/* No services available message */}
          {Object.values(serviceAvailability).every(available => !available) && (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="font-medium">No cloud services available</p>
              <p className="text-amber-700 mt-1">
                Please configure cloud storage services in Settings or log in to ZenTransfer.io.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CloudServiceSelector; 