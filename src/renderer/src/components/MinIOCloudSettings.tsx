import React from 'react';
import { Input } from './catalyst/input';
import { Field, Label, Description } from './catalyst/fieldset';
import { Switch, SwitchField } from './catalyst/switch';
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
      <Field>
        <Label htmlFor="minioEndpoint">
          Endpoint <span className="text-red-500">*</span>
        </Label>
        <Input
          id="minioEndpoint"
          type="text"
          value={endpoint}
          onChange={(e) => onEndpointChange(e.target.value)}
          placeholder="minio.example.com"
          required
        />
        <Description>
          Enter the MinIO server hostname or IP address (without protocol)
        </Description>
      </Field>

      <Field>
        <Label htmlFor="minioPort">Port</Label>
        <Input
          id="minioPort"
          type="number"
          value={port.toString()}
          onChange={(e) => onPortChange(parseInt(e.target.value) || 9000)}
          placeholder="9000"
          min={1}
          max={65535}
        />
        <Description>
          Default: 9000 (HTTP), 9443 (HTTPS)
        </Description>
      </Field>

      <SwitchField>
        <Label>Use SSL/TLS</Label>
        <Description>Enable secure connections (HTTPS)</Description>
        <Switch
          checked={useSSL}
          onChange={onUseSSLChange}
        />
      </SwitchField>

      <Field>
        <Label htmlFor="minioBucket">
          Bucket Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="minioBucket"
          type="text"
          value={bucket}
          onChange={(e) => onBucketChange(e.target.value)}
          placeholder="my-bucket"
          required
        />
        <Description>
          Bucket must exist and be accessible
        </Description>
      </Field>

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