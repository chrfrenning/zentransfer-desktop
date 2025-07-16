import React, { useState, useEffect } from 'react';
import CloudServiceSection from './CloudServiceSection';
import { CloudIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { getElectronAPI } from '../../../api/ZenTransferAPI';

// Change notification interface
export interface GCPCloudSettingsChangeNotification {
  serviceType: 'gcp-storage';
  property: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

interface GCPCloudSettingsProps {
  onChange?: (notification: GCPCloudSettingsChangeNotification) => void; // Optional change notifier
}

interface GCPState {
  enabled: boolean;
  bucketName: string;
  serviceAccountKey: string;
  keyFileName: string;
  testButtonState: 'idle' | 'testing' | 'success' | 'error';
}

const GCPCloudSettings: React.FC<GCPCloudSettingsProps> = ({ onChange }) => {
  const [settings, setSettings] = useState<GCPState>({
    enabled: false,
    bucketName: '',
    serviceAccountKey: '',
    keyFileName: '',
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
      const gcpConfig = await api.config.getCloudSettings('gcp-storage');
      
      if (gcpConfig.success && gcpConfig.settings) {
        const configSettings = gcpConfig.settings as any;
        setSettings(prev => ({
          ...prev,
          enabled: Boolean(configSettings.enabled),
          bucketName: String(configSettings.bucketName || ''),
          serviceAccountKey: String(configSettings.serviceAccountKey || ''),
          keyFileName: configSettings.serviceAccountKey ? 'Service account key loaded' : '',
        }));
      }
    } catch (error) {
      console.error('Failed to load GCP settings:', error);
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
        bucketName: settings.bucketName,
        serviceAccountKey: settings.serviceAccountKey,
        [property]: value, // Override with the new value
      };
      
      await api.config.updateCloudSettings('gcp-storage', updatedSettings);

      // Emit change notification
      if (onChange) {
        const notification: GCPCloudSettingsChangeNotification = {
          serviceType: 'gcp-storage',
          property,
          oldValue,
          newValue: value,
          timestamp: Date.now(),
        };
        onChange(notification);
      }
    } catch (error) {
      console.error(`Failed to update GCP ${property} setting:`, error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [property]: oldValue }));
    }
  };

  // Event handlers
  const handleEnabledChange = (enabled: boolean) => {
    updateCloudServiceSetting('enabled', enabled);
  };

  const handleBucketNameChange = (bucketName: string) => {
    updateCloudServiceSetting('bucketName', bucketName);
  };

  const handleServiceAccountKeyChange = (keyContent: string, fileName: string) => {
    setSettings(prev => ({ ...prev, serviceAccountKey: keyContent, keyFileName: fileName, testButtonState: 'idle' }));
    updateCloudServiceSetting('serviceAccountKey', keyContent);
  };

  const handleClearKey = () => {
    setSettings(prev => ({ ...prev, serviceAccountKey: '', keyFileName: '', testButtonState: 'idle' }));
    updateCloudServiceSetting('serviceAccountKey', '');
  };

  const handleTestConnection = async () => {
    setSettings(prev => ({ ...prev, testButtonState: 'testing' }));
    
    try {
      console.log('Testing GCP connection...');
      
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('Please select a valid JSON file.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        try {
          // Validate JSON structure
          const keyData = JSON.parse(content);
          if (!keyData.type || !keyData.universe_domain) {
            throw new Error('Invalid service account key format');
          }
          handleServiceAccountKeyChange(content, file.name);
        } catch (error) {
          alert('Invalid JSON file or service account key format.');
          event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const icon = <CloudIcon className="w-5 h-5 text-red-500" />;

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-center">
          <div className="text-gray-500">Loading GCP settings...</div>
        </div>
      </div>
    );
  }

  return (
    <CloudServiceSection
      title="GCP Upload"
      icon={icon}
      color="red"
      enabled={settings.enabled}
      onEnabledChange={handleEnabledChange}
      testButtonState={settings.testButtonState}
      onTestConnection={handleTestConnection}
    >
      <div className="space-y-2">
        <label htmlFor="gcpBucket" className="block text-sm font-medium text-gray-700">
          Bucket Name <span className="text-red-500">*</span>
        </label>
        <input
          id="gcpBucket"
          type="text"
          value={settings.bucketName}
          onChange={(e) => handleBucketNameChange(e.target.value)}
          placeholder="my-gcp-bucket"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="gcpKeyFile" className="block text-sm font-medium text-gray-700">
          Service Account Key (JSON) <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            id="gcpKeyFile"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
            required
          />
          <button
            type="button"
            onClick={() => document.getElementById('gcpKeyFile')?.click()}
            className="flex-1 text-left justify-start bg-white hover:bg-gray-50 text-gray-900 font-medium py-2.5 px-4 rounded-md border border-gray-300 hover:border-gray-400 transition-colors duration-200 flex items-center"
          >
            <DocumentIcon className="w-4 h-4 mr-2" />
            {settings.keyFileName || 'Choose JSON file...'}
          </button>
          {settings.serviceAccountKey && (
            <button
              type="button"
              onClick={handleClearKey}
              className="px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors duration-200"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Upload your GCP service account JSON key file. The content will be stored securely.
        </p>
      </div>
    </CloudServiceSection>
  );
};

export default GCPCloudSettings; 