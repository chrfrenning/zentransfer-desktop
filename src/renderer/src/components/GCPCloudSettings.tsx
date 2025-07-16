import React from 'react';
import { Input } from './catalyst/input';
import { Button } from './catalyst/button';
import { Field, Label, Description } from './catalyst/fieldset';
import CloudServiceSection from './CloudServiceSection';
import { CloudIcon, DocumentIcon } from '@heroicons/react/24/outline';

interface GCPCloudSettingsProps {
  enabled: boolean;
  bucketName: string;
  serviceAccountKey: string;
  keyFileName: string;
  testButtonState: 'idle' | 'testing' | 'success' | 'error';
  onEnabledChange: (enabled: boolean) => void;
  onBucketNameChange: (bucketName: string) => void;
  onServiceAccountKeyChange: (keyContent: string, fileName: string) => void;
  onClearKey: () => void;
  onTestConnection: () => void;
}

const GCPCloudSettings: React.FC<GCPCloudSettingsProps> = ({
  enabled,
  bucketName,
  serviceAccountKey,
  keyFileName,
  testButtonState,
  onEnabledChange,
  onBucketNameChange,
  onServiceAccountKeyChange,
  onClearKey,
  onTestConnection,
}) => {
  const icon = <CloudIcon className="w-5 h-5 text-red-500" />;

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
          onServiceAccountKeyChange(content, file.name);
        } catch (error) {
          alert('Invalid JSON file or service account key format.');
          event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <CloudServiceSection
      title="GCP Upload"
      icon={icon}
      color="red"
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      testButtonState={testButtonState}
      onTestConnection={onTestConnection}
    >
      <Field>
        <Label htmlFor="gcpBucket">
          Bucket Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="gcpBucket"
          type="text"
          value={bucketName}
          onChange={(e) => onBucketNameChange(e.target.value)}
          placeholder="my-gcp-bucket"
          required
        />
      </Field>

      <Field>
        <Label htmlFor="gcpKeyFile">
          Service Account Key (JSON) <span className="text-red-500">*</span>
        </Label>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            id="gcpKeyFile"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
            required
          />
          <Button
            type="button"
            outline
            onClick={() => document.getElementById('gcpKeyFile')?.click()}
            className="flex-1 text-left justify-start"
          >
            <DocumentIcon className="w-4 h-4 mr-2" />
            {keyFileName || 'Choose JSON file...'}
          </Button>
          {serviceAccountKey && (
            <Button
              type="button"
              color="red"
              onClick={onClearKey}
              className="px-3"
            >
              Clear
            </Button>
          )}
        </div>
        <Description>
          Upload your GCP service account JSON key file. The content will be stored securely.
        </Description>
      </Field>
    </CloudServiceSection>
  );
};

export default GCPCloudSettings; 