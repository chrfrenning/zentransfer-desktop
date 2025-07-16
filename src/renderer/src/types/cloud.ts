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
  readonly serviceType: string;
  readonly enabled: boolean;
  readonly [key: string]: unknown; // Additional service-specific properties
}

export interface UpdateSettingsResult {
  readonly success: boolean;
  readonly serviceInfo?: Record<string, unknown>;
  readonly error?: string;
}

export interface CloudServiceSettings {
  readonly [key: string]: unknown;
}

// Enhanced cloud service with runtime information
export interface CloudService {
  readonly type: CloudServiceType;
  readonly name: string;
  readonly enabled: boolean;
  readonly configured: boolean;
}

export interface AwsRegion {
  readonly code: string;
  readonly name: string;
  readonly location: string;
} 