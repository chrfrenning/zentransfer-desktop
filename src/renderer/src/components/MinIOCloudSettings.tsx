import React from 'react';
import SecureInput from './SecureInput';
import CloudServiceSection from './CloudServiceSection';
import { CloudIcon } from '@heroicons/react/24/outline';

interface MinIOCloudSettingsProps {
  enabled: boolean;
  endpoint: string;
  port: number;
  useSSL: boolean;
  bucket: string;
  accessKey: string;
  secretKey: string;
  testButtonState: 'idle' | 'testing' | 'success' | 'error';
  onEnabledChange: (enabled: boolean) => void;
  onEndpointChange: (endpoint: string) => void;
  onPortChange: (port: number) => void;
  onUseSSLChange: (useSSL: boolean) => void;
  onBucketChange: (bucket: string) => void;
  onAccessKeyChange: (accessKey: string) => void;
  onSecretKeyChange: (secretKey: string) => void;
  onTestConnection: () => void;
}

const MinIOCloudSettings: React.FC<MinIOCloudSettingsProps> = ({
  enabled,
  endpoint,
  port,
  useSSL,
  bucket,
  accessKey,
  secretKey,
  testButtonState,
  onEnabledChange,
  onEndpointChange,
  onPortChange,
  onUseSSLChange,
  onBucketChange,
  onAccessKeyChange,
  onSecretKeyChange,
  onTestConnection,
}) => {
  const icon = <CloudIcon className="w-5 h-5 text-purple-500" />;

  return (
    <CloudServiceSection
      title="MinIO Upload"
      icon={icon}
      color="purple"
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      testButtonState={testButtonState}
      onTestConnection={onTestConnection}
    >
      <div className="space-y-2">
        <label htmlFor="minioEndpoint" className="block text-sm font-medium text-gray-700">
          Endpoint <span className="text-red-500">*</span>
        </label>
        <input
          id="minioEndpoint"
          type="text"
          value={endpoint}
          onChange={(e) => onEndpointChange(e.target.value)}
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
          value={port.toString()}
          onChange={(e) => onPortChange(parseInt(e.target.value) || 9000)}
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
            onClick={() => onUseSSLChange(!useSSL)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              useSSL ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                useSSL ? 'translate-x-5' : 'translate-x-0'
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
          value={bucket}
          onChange={(e) => onBucketChange(e.target.value)}
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
        value={accessKey}
        onChange={onAccessKeyChange}
        placeholder="Enter MinIO access key"
        required
      />

      <SecureInput
        id="minioSecretKey"
        label="Secret Key"
        value={secretKey}
        onChange={onSecretKeyChange}
        placeholder="Enter MinIO secret key"
        required
      />
    </CloudServiceSection>
  );
};

export default MinIOCloudSettings; 