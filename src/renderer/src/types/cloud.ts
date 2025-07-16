export type CloudServiceType = 
  | 'zentransfer' 
  | 'aws-s3' 
  | 'azure-blob' 
  | 'gcp-storage' 
  | 'minio';

export interface ServiceDisplayInfo {
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly color: string;
}

export interface EnabledService {
  readonly serviceType: CloudServiceType;
}

export interface ServiceWithDisplayInfo extends ServiceDisplayInfo {
  readonly type: CloudServiceType;
}

export interface CloudSettingsResult {
  readonly success: boolean;
  readonly settings?: Record<string, unknown>;
  readonly error?: string;
}

export interface UpdateSettingsResult {
  readonly success: boolean;
  readonly serviceInfo?: Record<string, unknown>;
  readonly error?: string;
}

export interface CloudServiceSettings {
  readonly [key: string]: unknown;
} 