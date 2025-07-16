import React from 'react';
import SecureInput from './SecureInput';
import CloudServiceSection from './CloudServiceSection';
import { CloudIcon } from '@heroicons/react/24/outline';

interface AWSCloudSettingsProps {
  enabled: boolean;
  region: string;
  bucket: string;
  storageClass: string;
  accessKey: string;
  secretKey: string;
  regions: string[];
  testButtonState: 'idle' | 'testing' | 'success' | 'error';
  onEnabledChange: (enabled: boolean) => void;
  onRegionChange: (region: string) => void;
  onBucketChange: (bucket: string) => void;
  onStorageClassChange: (storageClass: string) => void;
  onAccessKeyChange: (accessKey: string) => void;
  onSecretKeyChange: (secretKey: string) => void;
  onTestConnection: () => void;
}

const AWSCloudSettings: React.FC<AWSCloudSettingsProps> = ({
  enabled,
  region,
  bucket,
  storageClass,
  accessKey,
  secretKey,
  regions,
  testButtonState,
  onEnabledChange,
  onRegionChange,
  onBucketChange,
  onStorageClassChange,
  onAccessKeyChange,
  onSecretKeyChange,
  onTestConnection,
}) => {
  const icon = <CloudIcon className="w-5 h-5 text-orange-500" />;

  return (
    <CloudServiceSection
      title="AWS S3 Upload"
      icon={icon}
      color="orange"
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      testButtonState={testButtonState}
      onTestConnection={onTestConnection}
    >

      <div>
        <label htmlFor="awsS3Bucket" className="block text-sm font-medium text-gray-700 mb-1">
          Bucket Name <span className="text-red-500">*</span>
        </label>
        <input
          id="awsS3Bucket"
          type="text"
          value={bucket}
          onChange={(e) => onBucketChange(e.target.value)}
          placeholder="my-bucket-name"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      <div>
        <label htmlFor="awsS3StorageTier" className="block text-sm font-medium text-gray-700 mb-1">Storage Tier</label>
        <select
          id="awsS3StorageTier"
          value={storageClass}
          onChange={(e) => onStorageClassChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="STANDARD">Standard - Frequently accessed data</option>
          <option value="REDUCED_REDUNDANCY">Reduced Redundancy - Non-critical, reproducible data</option>
          <option value="STANDARD_IA">Standard-IA - Infrequently accessed data</option>
          <option value="ONEZONE_IA">One Zone-IA - Infrequently accessed, non-critical data</option>
          <option value="INTELLIGENT_TIERING">Intelligent Tiering - Automatic cost optimization</option>
          <option value="GLACIER">Glacier - Long-term archive (minutes to hours retrieval)</option>
          <option value="DEEP_ARCHIVE">Glacier Deep Archive - Long-term archive (12+ hours retrieval)</option>
          <option value="GLACIER_IR">Glacier Instant Retrieval - Archive with instant access</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Choose the storage class based on your access patterns and cost requirements.
        </p>
      </div>

      <SecureInput
        id="awsS3AccessKey"
        label="Access Key ID"
        value={accessKey}
        onChange={onAccessKeyChange}
        placeholder="AWS Access Key"
        required
      />

      <SecureInput
        id="awsS3SecretKey"
        label="Secret Key"
        value={secretKey}
        onChange={onSecretKeyChange}
        placeholder="AWS Secret Key"
        required
      />
      
      <div>
        <label htmlFor="awsS3Region" className="block text-sm font-medium text-gray-700 mb-1">
          Region <span className="text-red-500">*</span>
        </label>
        <select
          id="awsS3Region"
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="">Select a region</option>
          {regions.map((regionCode) => (
            <option key={regionCode} value={regionCode}>
              {regionCode}
            </option>
          ))}
        </select>
      </div>
    </CloudServiceSection>
  );
};

export default AWSCloudSettings; 