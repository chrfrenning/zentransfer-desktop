import React, { useState, useEffect } from 'react';
import SecureInput from './SecureInput';
import CloudServiceSection from './CloudServiceSection';
import { CloudIcon } from '@heroicons/react/24/outline';
import { getElectronAPI } from '../api/ZenTransferAPI';

// Change notification interface
export interface MinIOCloudSettingsChangeNotification {
  serviceType: 'minio';
  property: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

interface MinIOCloudSettingsProps {
  onChange?: (notification: MinIOCloudSettingsChangeNotification) => void; // Optional change notifier
}

interface MinIOState {
  enabled: boolean;
  endpoint: string;
  port: number;
  useSSL: boolean;
  bucket: string;
  accessKey: string;
  secretKey: string;
  testButtonState: 'idle' | 'testing' | 'success' | 'error';
}

const MinIOCloudSettings: React.FC<MinIOCloudSettingsProps> = ({ onChange }) => {
  const [settings, setSettings] = useState<MinIOState>({
    enabled: false,
    endpoint: '',
    port: 9000,
    useSSL: true,
    bucket: '',
    accessKey: '',
    secretKey: '',
    testButtonState: 'idle',
  });

  const [loading, setLoading] = useState<boolean>(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const api = getElectronAPI();
      const minioConfig = await api.config.getCloudSettings('minio');
      
      if (minioConfig.success && minioConfig.settings) {
        const configSettings = minioConfig.settings as any;
        setSettings(prev => ({
          ...prev,
          enabled: Boolean(configSettings.enabled),
          endpoint: String(configSettings.endpoint || ''),
          port: Number(configSettings.port) || 9000,
          useSSL: configSettings.useSSL !== false,
          bucket: String(configSettings.bucket || ''),
          accessKey: String(configSettings.accessKey || ''),
          secretKey: String(configSettings.secretKey || ''),
        }));
      }
    } catch (error) {
      console.error('Failed to load MinIO settings:', error);
    } finally {
      setLoading(false);
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
        endpoint: settings.endpoint,
        port: settings.port,
        useSSL: settings.useSSL,
        bucket: settings.bucket,
        accessKey: settings.accessKey,
        secretKey: settings.secretKey,
        [property]: value, // Override with the new value
      };
      
      await api.config.updateCloudSettings('minio', updatedSettings);

      // Emit change notification
      if (onChange) {
        const notification: MinIOCloudSettingsChangeNotification = {
          serviceType: 'minio',
          property,
          oldValue,
          newValue: value,
          timestamp: Date.now(),
        };
        onChange(notification);
      }
    } catch (error) {
      console.error(`Failed to update MinIO ${property} setting:`, error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [property]: oldValue }));
    }
  };

  // Event handlers
  const handleEnabledChange = (enabled: boolean) => {
    updateCloudServiceSetting('enabled', enabled);
  };

  const handleEndpointChange = (endpoint: string) => {
    updateCloudServiceSetting('endpoint', endpoint);
  };

  const handlePortChange = (port: number) => {
    updateCloudServiceSetting('port', port);
  };

  const handleUseSSLChange = (useSSL: boolean) => {
    updateCloudServiceSetting('useSSL', useSSL);
  };

  const handleBucketChange = (bucket: string) => {
    updateCloudServiceSetting('bucket', bucket);
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
      console.log('Testing MinIO connection...');
      
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

  const icon = <CloudIcon className="w-5 h-5 text-purple-500" />;

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-center">
          <div className="text-gray-500">Loading MinIO settings...</div>
        </div>
      </div>
    );
  }

  return (
    <CloudServiceSection
      title="MinIO Upload"
      icon={icon}
      color="purple"
      enabled={settings.enabled}
      onEnabledChange={handleEnabledChange}
      testButtonState={settings.testButtonState}
      onTestConnection={handleTestConnection}
    >
      <div className="space-y-2">
        <label htmlFor="minioEndpoint" className="block text-sm font-medium text-gray-700">
          Endpoint <span className="text-red-500">*</span>
        </label>
        <input
          id="minioEndpoint"
          type="text"
          value={settings.endpoint}
          onChange={(e) => handleEndpointChange(e.target.value)}
          placeholder="minio.example.com"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
        <p className="text-sm text-gray-500">
          Enter the MinIO server hostname or IP address (without protocol)
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="minioPort" className="block text-sm font-medium text-gray-700">Port</label>
        <input
          id="minioPort"
          type="number"
          value={settings.port.toString()}
          onChange={(e) => handlePortChange(parseInt(e.target.value) || 9000)}
          placeholder="9000"
          min={1}
          max={65535}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
        <p className="text-sm text-gray-500">
          Default: 9000 (HTTP), 9443 (HTTPS)
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700">Use SSL/TLS</label>
            <p className="text-sm text-gray-500">Enable secure connections (HTTPS)</p>
          </div>
          <button
            type="button"
            onClick={() => handleUseSSLChange(!settings.useSSL)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              settings.useSSL ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                settings.useSSL ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="minioBucket" className="block text-sm font-medium text-gray-700">
          Bucket Name <span className="text-red-500">*</span>
        </label>
        <input
          id="minioBucket"
          type="text"
          value={settings.bucket}
          onChange={(e) => handleBucketChange(e.target.value)}
          placeholder="my-bucket"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
        <p className="text-sm text-gray-500">
          Bucket must exist and be accessible
        </p>
      </div>

      <SecureInput
        id="minioAccessKey"
        label="Access Key"
        value={settings.accessKey}
        onChange={handleAccessKeyChange}
        placeholder="Enter MinIO access key"
        required
      />

      <SecureInput
        id="minioSecretKey"
        label="Secret Key"
        value={settings.secretKey}
        onChange={handleSecretKeyChange}
        placeholder="Enter MinIO secret key"
        required
      />
    </CloudServiceSection>
  );
};

export default MinIOCloudSettings; 