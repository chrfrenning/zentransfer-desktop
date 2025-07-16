import React from 'react';
import { Input } from './catalyst/input';
import { Field, Label } from './catalyst/fieldset';
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
      <Field>
        <Label htmlFor="azureContainer">
          Container Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="azureContainer"
          type="text"
          value={containerName}
          onChange={(e) => onContainerNameChange(e.target.value)}
          placeholder="my-container"
          required
        />
      </Field>

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