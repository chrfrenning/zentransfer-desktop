import React from 'react';
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
      <div className="space-y-2">
        <label htmlFor="gcpBucket" className="block text-sm font-medium text-gray-700">
          Bucket Name <span className="text-red-500">*</span>
        </label>
        <input
          id="gcpBucket"
          type="text"
          value={bucketName}
          onChange={(e) => onBucketNameChange(e.target.value)}
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
            {keyFileName || 'Choose JSON file...'}
          </button>
          {serviceAccountKey && (
            <button
              type="button"
              onClick={onClearKey}
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