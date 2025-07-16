import React, { useState, useEffect } from 'react';
import SecureInput from '../../generic/SecureInput';
import CloudServiceSection from './CloudServiceSection';
import { CloudIcon } from '@heroicons/react/24/outline';
import { getElectronAPI } from '../../../api/ZenTransferAPI';

// Change notification interface
export interface AzureCloudSettingsChangeNotification {
  serviceType: 'azure-blob';
  property: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

interface AzureCloudSettingsProps {
  onChange?: (notification: AzureCloudSettingsChangeNotification) => void; // Optional change notifier
}

interface AzureState {
  enabled: boolean;
  containerName: string;
  connectionString: string;
  testButtonState: 'idle' | 'testing' | 'success' | 'error';
}

const AzureCloudSettings: React.FC<AzureCloudSettingsProps> = ({ onChange }) => {
  const [settings, setSettings] = useState<AzureState>({
    enabled: false,
    containerName: '',
    connectionString: '',
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
      const azureConfig = await api.config.getCloudSettings('azure-blob');
      
      if (azureConfig) {
        setSettings(prev => ({
          ...prev,
          enabled: Boolean(azureConfig.enabled),
          containerName: String(azureConfig['containerName'] || ''),
          connectionString: String(azureConfig['connectionString'] || ''),
        }));
      }
    } catch (error) {
      console.error('Failed to load Azure settings:', error);
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
        containerName: settings.containerName,
        connectionString: settings.connectionString,
        [property]: value, // Override with the new value
      };
      
      await api.config.updateCloudSettings('azure-blob', updatedSettings);

      // Emit change notification
      if (onChange) {
        const notification: AzureCloudSettingsChangeNotification = {
          serviceType: 'azure-blob',
          property,
          oldValue,
          newValue: value,
          timestamp: Date.now(),
        };
        onChange(notification);
      }
    } catch (error) {
      console.error(`Failed to update Azure ${property} setting:`, error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [property]: oldValue }));
    }
  };

  // Event handlers
  const handleEnabledChange = (enabled: boolean) => {
    updateCloudServiceSetting('enabled', enabled);
  };

  const handleContainerNameChange = (containerName: string) => {
    updateCloudServiceSetting('containerName', containerName);
  };

  const handleConnectionStringChange = (connectionString: string) => {
    updateCloudServiceSetting('connectionString', connectionString);
  };

  const handleTestConnection = async () => {
    setSettings(prev => ({ ...prev, testButtonState: 'testing' }));
    
    try {
      console.log('Testing Azure connection...');
      
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

  const icon = <CloudIcon className="w-5 h-5 text-blue-500" />;

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-center">
          <div className="text-gray-500">Loading Azure settings...</div>
        </div>
      </div>
    );
  }

  return (
    <CloudServiceSection
      title="Azure Upload"
      icon={icon}
      color="blue"
      enabled={settings.enabled}
      onEnabledChange={handleEnabledChange}
      testButtonState={settings.testButtonState}
      onTestConnection={handleTestConnection}
    >
      <div className="space-y-2">
        <label htmlFor="azureContainer" className="block text-sm font-medium text-gray-700">
          Container Name <span className="text-red-500">*</span>
        </label>
        <input
          id="azureContainer"
          type="text"
          value={settings.containerName}
          onChange={(e) => handleContainerNameChange(e.target.value)}
          placeholder="my-container"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>

      <SecureInput
        id="azureConnectionString"
        label="Connection String"
        value={settings.connectionString}
        onChange={handleConnectionStringChange}
        placeholder="DefaultEndpointsProtocol=https;AccountName=..."
        required
      />
    </CloudServiceSection>
  );
};

export default AzureCloudSettings; 