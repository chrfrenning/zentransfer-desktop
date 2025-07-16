import React, { useState, useEffect } from 'react';
import SecureInput from './SecureInput';
import CloudServiceSection from './CloudServiceSection';
import { CloudIcon } from '@heroicons/react/24/outline';
import type { AwsRegion } from '../types/cloud';
import { getElectronAPI } from '../api/ZenTransferAPI';

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

  const [awsRegions, setAwsRegions] = useState<AwsRegion[]>([]);
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
      const sortedRegions = [...regions].sort((a, b) => a.code.localeCompare(b.code));
      setAwsRegions(sortedRegions);
    } catch (error) {
      console.error('Failed to load AWS regions:', error);
      // Fallback to common regions
      setAwsRegions([
        { code: 'us-east-1', name: 'US East (N. Virginia)', location: 'Virginia' },
        { code: 'us-west-2', name: 'US West (Oregon)', location: 'Oregon' },
        { code: 'eu-west-1', name: 'Europe (Ireland)', location: 'Ireland' },
        { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', location: 'Singapore' }
      ]);
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
        <select
          id="awsS3StorageTier"
          value={settings.storageClass}
          onChange={(e) => handleStorageClassChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option key="STANDARD" value="STANDARD">Standard - Frequently accessed data</option>
          <option key="REDUCED_REDUNDANCY" value="REDUCED_REDUNDANCY">Reduced Redundancy - Non-critical, reproducible data</option>
          <option key="STANDARD_IA" value="STANDARD_IA">Standard-IA - Infrequently accessed data</option>
          <option key="ONEZONE_IA" value="ONEZONE_IA">One Zone-IA - Infrequently accessed, non-critical data</option>
          <option key="INTELLIGENT_TIERING" value="INTELLIGENT_TIERING">Intelligent Tiering - Automatic cost optimization</option>
          <option key="GLACIER" value="GLACIER">Glacier - Long-term archive (minutes to hours retrieval)</option>
          <option key="DEEP_ARCHIVE" value="DEEP_ARCHIVE">Glacier Deep Archive - Long-term archive (12+ hours retrieval)</option>
          <option key="GLACIER_IR" value="GLACIER_IR">Glacier Instant Retrieval - Archive with instant access</option>
        </select>
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
        <select
          id="awsS3Region"
          value={settings.region}
          onChange={(e) => handleRegionChange(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option key="" value="">Select a region</option>
          {awsRegions.map((region) => (
            <option key={region.code} value={region.code}>
              {region.code} - {region.name}
            </option>
          ))}
        </select>
      </div>
    </CloudServiceSection>
  );
};

export default AWSCloudSettings; 