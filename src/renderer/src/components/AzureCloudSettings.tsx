import React from 'react';
import SecureInput from './SecureInput';
import CloudServiceSection from './CloudServiceSection';
import { CloudIcon } from '@heroicons/react/24/outline';

interface AzureCloudSettingsProps {
  enabled: boolean;
  containerName: string;
  connectionString: string;
  testButtonState: 'idle' | 'testing' | 'success' | 'error';
  onEnabledChange: (enabled: boolean) => void;
  onContainerNameChange: (containerName: string) => void;
  onConnectionStringChange: (connectionString: string) => void;
  onTestConnection: () => void;
}

const AzureCloudSettings: React.FC<AzureCloudSettingsProps> = ({
  enabled,
  containerName,
  connectionString,
  testButtonState,
  onEnabledChange,
  onContainerNameChange,
  onConnectionStringChange,
  onTestConnection,
}) => {
  const icon = <CloudIcon className="w-5 h-5 text-blue-500" />;

  return (
    <CloudServiceSection
      title="Azure Upload"
      icon={icon}
      color="blue"
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      testButtonState={testButtonState}
      onTestConnection={onTestConnection}
    >
      <div className="space-y-2">
        <label htmlFor="azureContainer" className="block text-sm font-medium text-gray-700">
          Container Name <span className="text-red-500">*</span>
        </label>
        <input
          id="azureContainer"
          type="text"
          value={containerName}
          onChange={(e) => onContainerNameChange(e.target.value)}
          placeholder="my-container"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>

      <SecureInput
        id="azureConnectionString"
        label="Connection String"
        value={connectionString}
        onChange={onConnectionStringChange}
        placeholder="DefaultEndpointsProtocol=https;AccountName=..."
        required
      />
    </CloudServiceSection>
  );
};

export default AzureCloudSettings; 