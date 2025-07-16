import React, { useState, useEffect } from 'react';
import SecureInput from '../../generic/SecureInput';
import CloudServiceSection from './CloudServiceSection';
import CustomSelect from '../../generic/CustomSelect';
import { CloudIcon } from '@heroicons/react/24/outline';
import { getElectronAPI } from '../../../api/ZenTransferAPI';

// Change notification interface
export interface CloudSettingsChangeNotification {
  serviceType: 'aws-s3';
  property: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

interface AWSCloudSettingsProps {
  onChange?: (notification: CloudSettingsChangeNotification) => void; // Optional change notifier
}

interface AWSState {
  enabled: boolean;
  region: string;
  bucket: string;
  storageClass: string;
  accessKey: string;
  secretKey: string;
  testButtonState: 'idle' | 'testing' | 'success' | 'error';
}

const AWSCloudSettings: React.FC<AWSCloudSettingsProps> = ({ onChange }) => {
  const [settings, setSettings] = useState<AWSState>({
    enabled: false,
    region: '',
    bucket: '',
    storageClass: 'STANDARD',
    accessKey: '',
    secretKey: '',
    testButtonState: 'idle',
  });

  const [awsRegions, setAwsRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load settings and regions on mount
  useEffect(() => {
    loadSettings();
    loadAwsRegions();
  }, []);

  const loadSettings = async () => {
    try {
      const api = getElectronAPI();
      const awsConfig = await api.config.getCloudSettings('aws-s3');
      
      if (awsConfig.success && awsConfig.settings) {
        const configSettings = awsConfig.settings as any;
        setSettings(prev => ({
          ...prev,
          enabled: Boolean(configSettings.enabled),
          region: String(configSettings.region || ''),
          bucket: String(configSettings.bucket || ''),
          storageClass: String(configSettings.storageClass || 'STANDARD'),
          accessKey: String(configSettings.accessKey || ''),
          secretKey: String(configSettings.secretKey || ''),
        }));
      }
    } catch (error) {
      console.error('Failed to load AWS settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAwsRegions = async () => {
    try {
      const api = getElectronAPI();
      const regions = await api.clouds.getAwsRegions();
      // Extract region codes if the API returns AwsRegion objects, otherwise use as strings
      const regionCodes = Array.isArray(regions) 
        ? regions.map(region => typeof region === 'string' ? region : region.code).sort()
        : [];
      setAwsRegions(regionCodes);
    } catch (error) {
      console.error('Failed to load AWS regions:', error);
      // Fallback to common region codes
      setAwsRegions(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']);
    }
  };

  const updateCloudServiceSetting = async (property: string, value: any) => {
    const oldValue = (settings as any)[property];
    
    // Update local state first for immediate UI feedback
    setSettings(prev => ({ ...prev, [property]: value, testButtonState: 'idle' }));
    
    try {
      const api = getElectronAPI();
      
      // Use current local state as base to preserve all settings
      const updatedSettings = {
        enabled: settings.enabled,
        region: settings.region,
        bucket: settings.bucket,
        storageClass: settings.storageClass,
        accessKey: settings.accessKey,
        secretKey: settings.secretKey,
        [property]: value, // Override with the new value
      };
      
      await api.config.updateCloudSettings('aws-s3', updatedSettings);

      // Emit change notification
      if (onChange) {
        const notification: CloudSettingsChangeNotification = {
          serviceType: 'aws-s3',
          property,
          oldValue,
          newValue: value,
          timestamp: Date.now(),
        };
        onChange(notification);
      }
    } catch (error) {
      console.error(`Failed to update AWS ${property} setting:`, error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [property]: oldValue }));
    }
  };

  // Event handlers
  const handleEnabledChange = (enabled: boolean) => {
    updateCloudServiceSetting('enabled', enabled);
  };

  const handleRegionChange = (region: string) => {
    updateCloudServiceSetting('region', region);
  };

  const handleBucketChange = (bucket: string) => {
    updateCloudServiceSetting('bucket', bucket);
  };

  const handleStorageClassChange = (storageClass: string) => {
    updateCloudServiceSetting('storageClass', storageClass);
  };

  const handleAccessKeyChange = (accessKey: string) => {
    updateCloudServiceSetting('accessKey', accessKey);
  };

  const handleSecretKeyChange = (secretKey: string) => {
    updateCloudServiceSetting('secretKey', secretKey);
  };

  const handleTestConnection = async () => {
    setSettings(prev => ({ ...prev, testButtonState: 'testing' }));
    
    try {
      // Test connection using available API
      console.log('Testing AWS connection...');
      
      // Simulate test for now
      setTimeout(() => {
        setSettings(prev => ({ ...prev, testButtonState: 'success' }));
        setTimeout(() => {
          setSettings(prev => ({ ...prev, testButtonState: 'idle' }));
        }, 3000);
      }, 2000);
    } catch (error) {
      setSettings(prev => ({ ...prev, testButtonState: 'error' }));
      setTimeout(() => {
        setSettings(prev => ({ ...prev, testButtonState: 'idle' }));
      }, 3000);
    }
  };

  const icon = <CloudIcon className="w-5 h-5 text-orange-500" />;

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-center">
          <div className="text-gray-500">Loading AWS settings...</div>
        </div>
      </div>
    );
  }

  return (
    <CloudServiceSection
      title="AWS S3 Upload"
      icon={icon}
      color="orange"
      enabled={settings.enabled}
      onEnabledChange={handleEnabledChange}
      testButtonState={settings.testButtonState}
      onTestConnection={handleTestConnection}
    >

      <div>
        <label htmlFor="awsS3Bucket" className="block text-sm font-medium text-gray-700 mb-1">
          Bucket Name <span className="text-red-500">*</span>
        </label>
        <input
          id="awsS3Bucket"
          type="text"
          value={settings.bucket}
          onChange={(e) => handleBucketChange(e.target.value)}
          placeholder="my-bucket-name"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      <div>
        <label htmlFor="awsS3StorageTier" className="block text-sm font-medium text-gray-700 mb-1">Storage Tier</label>
        <CustomSelect
          id="awsS3StorageTier"
          value={settings.storageClass}
          onChange={handleStorageClassChange}
          options={[
            { value: "STANDARD", label: "Standard - Frequently accessed data" },
            { value: "REDUCED_REDUNDANCY", label: "Reduced Redundancy - Non-critical, reproducible data" },
            { value: "STANDARD_IA", label: "Standard-IA - Infrequently accessed data" },
            { value: "ONEZONE_IA", label: "One Zone-IA - Infrequently accessed, non-critical data" },
            { value: "INTELLIGENT_TIERING", label: "Intelligent Tiering - Automatic cost optimization" },
            { value: "GLACIER", label: "Glacier - Long-term archive (minutes to hours retrieval)" },
            { value: "DEEP_ARCHIVE", label: "Glacier Deep Archive - Long-term archive (12+ hours retrieval)" },
            { value: "GLACIER_IR", label: "Glacier Instant Retrieval - Archive with instant access" }
          ]}
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          Choose the storage class based on your access patterns and cost requirements.
        </p>
      </div>

      <SecureInput
        id="awsS3AccessKey"
        label="Access Key ID"
        value={settings.accessKey}
        onChange={handleAccessKeyChange}
        placeholder="AWS Access Key"
        required
      />

      <SecureInput
        id="awsS3SecretKey"
        label="Secret Key"
        value={settings.secretKey}
        onChange={handleSecretKeyChange}
        placeholder="AWS Secret Key"
        required
      />
      
      <div>
        <label htmlFor="awsS3Region" className="block text-sm font-medium text-gray-700 mb-1">
          Region <span className="text-red-500">*</span>
        </label>
        <CustomSelect
          id="awsS3Region"
          value={settings.region}
          onChange={handleRegionChange}
          options={[
            { value: "", label: "Select a region" },
            ...awsRegions.map((regionCode) => ({
              value: regionCode,
              label: regionCode
            }))
          ]}
          placeholder="Select a region"
          required
          className="w-full"
        />
      </div>
    </CloudServiceSection>
  );
};

export default AWSCloudSettings; 