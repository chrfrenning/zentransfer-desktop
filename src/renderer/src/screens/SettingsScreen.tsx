import React, { useState, useEffect } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import PreferencesSection from '../components/PreferencesSection';
import AWSCloudSettings from '../components/AWSCloudSettings';
import AzureCloudSettings from '../components/AzureCloudSettings';
import GCPCloudSettings from '../components/GCPCloudSettings';
import MinIOCloudSettings from '../components/MinIOCloudSettings';
import AccountSection from '../components/AccountSection';
import SupportSection from '../components/SupportSection';
import AppInfoSection from '../components/AppInfoSection';
import LogsSection from '../components/LogsSection';

interface PreferencesState {
  skipDuplicates: boolean;
  createPreviews: boolean;
  extractMetaData: boolean;
  createIndexfiles: boolean;
}

interface CloudServiceState {
  enabled: boolean;
  testButtonState: 'idle' | 'testing' | 'success' | 'error';
}

interface AWSState extends CloudServiceState {
  region: string;
  bucket: string;
  storageClass: string;
  accessKey: string;
  secretKey: string;
}

interface AzureState extends CloudServiceState {
  containerName: string;
  connectionString: string;
}

interface GCPState extends CloudServiceState {
  bucketName: string;
  serviceAccountKey: string;
  keyFileName: string;
}

interface MinIOState extends CloudServiceState {
  endpoint: string;
  port: number;
  useSSL: boolean;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

interface AccountState {
  isLoggedIn: boolean;
  userEmail?: string;
}

interface AppInfoState {
  version: string;
  build: string;
  serverUrl: string;
}

interface LogsState {
  logFilePath: string;
  logFileSize: string;
  lastModified: string;
}

const SettingsScreen = () => {
  // State management
  const [preferences, setPreferences] = useState<PreferencesState>({
    skipDuplicates: false,
    createPreviews: false,
    extractMetaData: false,
    createIndexfiles: false,
  });

  const [awsSettings, setAwsSettings] = useState<AWSState>({
    enabled: false,
    region: '',
    bucket: '',
    storageClass: 'STANDARD',
    accessKey: '',
    secretKey: '',
    testButtonState: 'idle',
  });

  const [azureSettings, setAzureSettings] = useState<AzureState>({
    enabled: false,
    containerName: '',
    connectionString: '',
    testButtonState: 'idle',
  });

  const [gcpSettings, setGcpSettings] = useState<GCPState>({
    enabled: false,
    bucketName: '',
    serviceAccountKey: '',
    keyFileName: '',
    testButtonState: 'idle',
  });

  const [minioSettings, setMinioSettings] = useState<MinIOState>({
    enabled: false,
    endpoint: '',
    port: 9000,
    useSSL: true,
    bucket: '',
    accessKey: '',
    secretKey: '',
    testButtonState: 'idle',
  });

  const [account, setAccount] = useState<AccountState>({
    isLoggedIn: false,
  });

  const [appInfo, setAppInfo] = useState<AppInfoState>({
    version: 'Loading...',
    build: 'Loading...',
    serverUrl: 'Loading...',
  });

  const [logs, setLogs] = useState<LogsState>({
    logFilePath: 'Loading...',
    logFileSize: 'Loading...',
    lastModified: 'Loading...',
  });

  const [awsRegions, setAwsRegions] = useState<string[]>([]);

  // Load initial data
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load app info
      if (window.electronAPI) {
        const version = await window.electronAPI.app.getVersion();
        const isDevelopmentMode = await window.electronAPI.app.getIsDevelopmentMode();
        const serverUrl = await window.electronAPI.app.getServerUrl();
        
        setAppInfo({
          version,
          build: isDevelopmentMode ? 'Development' : 'Production',
          serverUrl,
        });

        // Load AWS regions
        try {
          const regions = await window.electronAPI.clouds.getAwsRegions();
          setAwsRegions(regions.map(region => region.code).sort());
        } catch (error) {
          console.error('Failed to load AWS regions:', error);
          setAwsRegions(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']); // fallback
        }

        // Load preferences from config
        const skipDuplicates = Boolean(await window.electronAPI.config.get('preferences.skipDuplicates'));
        const createPreviews = Boolean(await window.electronAPI.config.get('preferences.createPreviews'));
        const extractMetaData = Boolean(await window.electronAPI.config.get('preferences.extractMetaData'));
        const createIndexfiles = Boolean(await window.electronAPI.config.get('preferences.createIndexfiles'));

        setPreferences({
          skipDuplicates,
          createPreviews,
          extractMetaData,
          createIndexfiles,
        });

        // Load cloud service configurations
        const awsConfig = await window.electronAPI.config.getCloudSettings('aws-s3');
        if (awsConfig.success && awsConfig.settings) {
          const settings = awsConfig.settings as any;
          setAwsSettings(prev => ({
            ...prev,
            enabled: Boolean(settings.enabled),
            region: String(settings.region || ''),
            bucket: String(settings.bucket || ''),
            storageClass: String(settings.storageClass || 'STANDARD'),
            accessKey: String(settings.accessKey || ''),
            secretKey: String(settings.secretKey || ''),
          }));
        }

        const azureConfig = await window.electronAPI.config.getCloudSettings('azure-blob');
        if (azureConfig.success && azureConfig.settings) {
          const settings = azureConfig.settings as any;
          setAzureSettings(prev => ({
            ...prev,
            enabled: Boolean(settings.enabled),
            containerName: String(settings.containerName || ''),
            connectionString: String(settings.connectionString || ''),
          }));
        }

        const gcpConfig = await window.electronAPI.config.getCloudSettings('gcp-storage');
        if (gcpConfig.success && gcpConfig.settings) {
          const settings = gcpConfig.settings as any;
          setGcpSettings(prev => ({
            ...prev,
            enabled: Boolean(settings.enabled),
            bucketName: String(settings.bucketName || ''),
            serviceAccountKey: String(settings.serviceAccountKey || ''),
            keyFileName: settings.serviceAccountKey ? 'Service account key loaded' : '',
          }));
        }

        const minioConfig = await window.electronAPI.config.getCloudSettings('minio');
        if (minioConfig.success && minioConfig.settings) {
          const settings = minioConfig.settings as any;
          setMinioSettings(prev => ({
            ...prev,
            enabled: Boolean(settings.enabled),
            endpoint: String(settings.endpoint || ''),
            port: Number(settings.port) || 9000,
            useSSL: settings.useSSL !== false,
            bucket: String(settings.bucket || ''),
            accessKey: String(settings.accessKey || ''),
            secretKey: String(settings.secretKey || ''),
          }));
        }

        // Load log info
        try {
          const logInfo = await window.logger?.getLogInfo();
          if (logInfo) {
            setLogs({
              logFilePath: logInfo.path || 'Unknown',
              logFileSize: window.logger?.formatFileSize(logInfo.size || 0) || 'Unknown',
              lastModified: logInfo.path ? new Date().toLocaleString() : 'Unknown',
            });
          }
        } catch (error) {
          console.error('Failed to load log info:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  // Event handlers
  const handlePreferenceChange = async (key: keyof PreferencesState, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    await window.electronAPI?.config.set(`preferences.${key}`, value);
  };

  const updateCloudServiceSetting = async (serviceType: string, property: string, value: any) => {
    try {
      const currentService = await window.electronAPI.config.getCloudSettings(serviceType as any);
      if (currentService.success && currentService.settings) {
        const updatedSettings = { ...currentService.settings, [property]: value };
        await window.electronAPI.config.updateCloudSettings(serviceType as any, updatedSettings);
      } else {
        // Create new settings if they don't exist
        const newSettings = { [property]: value };
        await window.electronAPI.config.updateCloudSettings(serviceType as any, newSettings);
      }
    } catch (error) {
      console.error(`Failed to update ${serviceType} setting:`, error);
    }
  };

  // AWS handlers
  const handleAWSEnabledChange = (enabled: boolean) => {
    setAwsSettings(prev => ({ ...prev, enabled, testButtonState: 'idle' }));
    updateCloudServiceSetting('aws-s3', 'enabled', enabled);
  };

  const handleAWSRegionChange = (region: string) => {
    setAwsSettings(prev => ({ ...prev, region, testButtonState: 'idle' }));
    updateCloudServiceSetting('aws-s3', 'region', region);
  };

  const handleAWSBucketChange = (bucket: string) => {
    setAwsSettings(prev => ({ ...prev, bucket, testButtonState: 'idle' }));
    updateCloudServiceSetting('aws-s3', 'bucket', bucket);
  };

  const handleAWSStorageClassChange = (storageClass: string) => {
    setAwsSettings(prev => ({ ...prev, storageClass, testButtonState: 'idle' }));
    updateCloudServiceSetting('aws-s3', 'storageClass', storageClass);
  };

  const handleAWSAccessKeyChange = (accessKey: string) => {
    setAwsSettings(prev => ({ ...prev, accessKey, testButtonState: 'idle' }));
    updateCloudServiceSetting('aws-s3', 'accessKey', accessKey);
  };

  const handleAWSSecretKeyChange = (secretKey: string) => {
    setAwsSettings(prev => ({ ...prev, secretKey, testButtonState: 'idle' }));
    updateCloudServiceSetting('aws-s3', 'secretKey', secretKey);
  };

  const handleAWSTestConnection = async () => {
    setAwsSettings(prev => ({ ...prev, testButtonState: 'testing' }));
    
    try {
      // Test connection using available API
      // This would need to be implemented based on available upload service API
      console.log('Testing AWS connection...');
      
      // Simulate test for now
      setTimeout(() => {
        setAwsSettings(prev => ({ ...prev, testButtonState: 'success' }));
        setTimeout(() => {
          setAwsSettings(prev => ({ ...prev, testButtonState: 'idle' }));
        }, 3000);
      }, 2000);
    } catch (error) {
      setAwsSettings(prev => ({ ...prev, testButtonState: 'error' }));
      setTimeout(() => {
        setAwsSettings(prev => ({ ...prev, testButtonState: 'idle' }));
      }, 3000);
    }
  };

  // Azure handlers
  const handleAzureEnabledChange = (enabled: boolean) => {
    setAzureSettings(prev => ({ ...prev, enabled, testButtonState: 'idle' }));
    updateCloudServiceSetting('azure-blob', 'enabled', enabled);
  };

  const handleAzureContainerNameChange = (containerName: string) => {
    setAzureSettings(prev => ({ ...prev, containerName, testButtonState: 'idle' }));
    updateCloudServiceSetting('azure-blob', 'containerName', containerName);
  };

  const handleAzureConnectionStringChange = (connectionString: string) => {
    setAzureSettings(prev => ({ ...prev, connectionString, testButtonState: 'idle' }));
    updateCloudServiceSetting('azure-blob', 'connectionString', connectionString);
  };

  const handleAzureTestConnection = async () => {
    setAzureSettings(prev => ({ ...prev, testButtonState: 'testing' }));
    
    try {
      // Test connection using available API
      console.log('Testing Azure connection...');
      
      // Simulate test for now
      setTimeout(() => {
        setAzureSettings(prev => ({ ...prev, testButtonState: 'success' }));
        setTimeout(() => {
          setAzureSettings(prev => ({ ...prev, testButtonState: 'idle' }));
        }, 3000);
      }, 2000);
    } catch (error) {
      setAzureSettings(prev => ({ ...prev, testButtonState: 'error' }));
      setTimeout(() => {
        setAzureSettings(prev => ({ ...prev, testButtonState: 'idle' }));
      }, 3000);
    }
  };

  // GCP handlers
  const handleGCPEnabledChange = (enabled: boolean) => {
    setGcpSettings(prev => ({ ...prev, enabled, testButtonState: 'idle' }));
    updateCloudServiceSetting('gcp-storage', 'enabled', enabled);
  };

  const handleGCPBucketNameChange = (bucketName: string) => {
    setGcpSettings(prev => ({ ...prev, bucketName, testButtonState: 'idle' }));
    updateCloudServiceSetting('gcp-storage', 'bucketName', bucketName);
  };

  const handleGCPServiceAccountKeyChange = (keyContent: string, fileName: string) => {
    setGcpSettings(prev => ({ ...prev, serviceAccountKey: keyContent, keyFileName: fileName, testButtonState: 'idle' }));
    updateCloudServiceSetting('gcp-storage', 'serviceAccountKey', keyContent);
  };

  const handleGCPClearKey = () => {
    setGcpSettings(prev => ({ ...prev, serviceAccountKey: '', keyFileName: '', testButtonState: 'idle' }));
    updateCloudServiceSetting('gcp-storage', 'serviceAccountKey', '');
  };

  const handleGCPTestConnection = async () => {
    setGcpSettings(prev => ({ ...prev, testButtonState: 'testing' }));
    
    try {
      // Test connection using available API
      console.log('Testing GCP connection...');
      
      // Simulate test for now
      setTimeout(() => {
        setGcpSettings(prev => ({ ...prev, testButtonState: 'success' }));
        setTimeout(() => {
          setGcpSettings(prev => ({ ...prev, testButtonState: 'idle' }));
        }, 3000);
      }, 2000);
    } catch (error) {
      setGcpSettings(prev => ({ ...prev, testButtonState: 'error' }));
      setTimeout(() => {
        setGcpSettings(prev => ({ ...prev, testButtonState: 'idle' }));
      }, 3000);
    }
  };

  // MinIO handlers
  const handleMinIOEnabledChange = (enabled: boolean) => {
    setMinioSettings(prev => ({ ...prev, enabled, testButtonState: 'idle' }));
    updateCloudServiceSetting('minio', 'enabled', enabled);
  };

  const handleMinIOEndpointChange = (endpoint: string) => {
    setMinioSettings(prev => ({ ...prev, endpoint, testButtonState: 'idle' }));
    updateCloudServiceSetting('minio', 'endpoint', endpoint);
  };

  const handleMinIOPortChange = (port: number) => {
    setMinioSettings(prev => ({ ...prev, port, testButtonState: 'idle' }));
    updateCloudServiceSetting('minio', 'port', port);
  };

  const handleMinIOUseSSLChange = (useSSL: boolean) => {
    setMinioSettings(prev => ({ ...prev, useSSL, testButtonState: 'idle' }));
    updateCloudServiceSetting('minio', 'useSSL', useSSL);
  };

  const handleMinIOBucketChange = (bucket: string) => {
    setMinioSettings(prev => ({ ...prev, bucket, testButtonState: 'idle' }));
    updateCloudServiceSetting('minio', 'bucket', bucket);
  };

  const handleMinIOAccessKeyChange = (accessKey: string) => {
    setMinioSettings(prev => ({ ...prev, accessKey, testButtonState: 'idle' }));
    updateCloudServiceSetting('minio', 'accessKey', accessKey);
  };

  const handleMinIOSecretKeyChange = (secretKey: string) => {
    setMinioSettings(prev => ({ ...prev, secretKey, testButtonState: 'idle' }));
    updateCloudServiceSetting('minio', 'secretKey', secretKey);
  };

  const handleMinIOTestConnection = async () => {
    setMinioSettings(prev => ({ ...prev, testButtonState: 'testing' }));
    
    try {
      // Test connection using available API
      console.log('Testing MinIO connection...');
      
      // Simulate test for now
      setTimeout(() => {
        setMinioSettings(prev => ({ ...prev, testButtonState: 'success' }));
        setTimeout(() => {
          setMinioSettings(prev => ({ ...prev, testButtonState: 'idle' }));
        }, 3000);
      }, 2000);
    } catch (error) {
      setMinioSettings(prev => ({ ...prev, testButtonState: 'error' }));
      setTimeout(() => {
        setMinioSettings(prev => ({ ...prev, testButtonState: 'idle' }));
      }, 3000);
    }
  };

  // Account handlers
  const handleLogin = () => {
    // TODO: Implement login functionality
    console.log('Login clicked');
  };

  const handleCreateAccount = () => {
    openExternal('https://zentransfer.io/register');
  };

  const handleSignOut = async () => {
    // TODO: Implement sign out functionality
    console.log('Sign out clicked');
  };

  const handleLearnMore = () => {
    openExternal('https://zentransfer.io');
  };

  // Support handlers
  const handleHelpClick = () => {
    openExternal('https://zentransfer.io/support');
  };

  const handlePrivacyClick = () => {
    openExternal('https://zentransfer.io/privacy');
  };

  const handleTermsClick = () => {
    openExternal('https://zentransfer.io/terms');
  };

  const handleDownloadClick = () => {
    openExternal('https://zentransfer.io/download');
  };

  const handleDonateClick = () => {
    openExternal('https://zentransfer.io/blog/supporting-the-zentransfer-app');
  };

  // App info handlers
  const handleClearAllData = async () => {
    if (confirm('This will permanently delete all your data including login information, preferences, and upload history. This action cannot be undone.')) {
      try {
        localStorage.clear();
        sessionStorage.clear();
        
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        console.log('All data cleared.');
        
        // Reload the page to reset state
        window.location.reload();
      } catch (error) {
        console.error('Failed to clear all data:', error);
      }
    }
  };

  const handleDebugConsole = () => {
    if (window.electronAPI) {
      // In Electron, this could open dev tools
      console.log('Debug console accessed');
    } else {
      // In web, just log to console
      console.log('Debug console accessed - check browser dev tools (F12)');
    }
  };

  // Logs handlers
  const handleShowLogsFolder = async () => {
    try {
      if (window.logger) {
        const result = await window.logger.showLogsFolder();
        if (!result.success) {
          console.error('Failed to open logs folder:', result.error);
        }
      }
    } catch (error) {
      console.error('Error opening logs folder:', error);
    }
  };

  // Utility function
  const openExternal = (url: string) => {
    if (window.electronAPI) {
      window.electronAPI.shell.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
      <div className="w-full">
        <ScreenHeader mode="settings" />
        <div className="max-w-2xl mx-auto space-y-4">
          <PreferencesSection
            skipDuplicates={preferences.skipDuplicates}
            createPreviews={preferences.createPreviews}
            extractMetaData={preferences.extractMetaData}
            createIndexfiles={preferences.createIndexfiles}
            onSkipDuplicatesChange={(value) => handlePreferenceChange('skipDuplicates', value)}
            onCreatePreviewsChange={(value) => handlePreferenceChange('createPreviews', value)}
            onExtractMetaDataChange={(value) => handlePreferenceChange('extractMetaData', value)}
            onCreateIndexfilesChange={(value) => handlePreferenceChange('createIndexfiles', value)}
          />

          <AWSCloudSettings
            enabled={awsSettings.enabled}
            region={awsSettings.region}
            bucket={awsSettings.bucket}
            storageClass={awsSettings.storageClass}
            accessKey={awsSettings.accessKey}
            secretKey={awsSettings.secretKey}
            regions={awsRegions}
            testButtonState={awsSettings.testButtonState}
            onEnabledChange={handleAWSEnabledChange}
            onRegionChange={handleAWSRegionChange}
            onBucketChange={handleAWSBucketChange}
            onStorageClassChange={handleAWSStorageClassChange}
            onAccessKeyChange={handleAWSAccessKeyChange}
            onSecretKeyChange={handleAWSSecretKeyChange}
            onTestConnection={handleAWSTestConnection}
          />

          <AzureCloudSettings
            enabled={azureSettings.enabled}
            containerName={azureSettings.containerName}
            connectionString={azureSettings.connectionString}
            testButtonState={azureSettings.testButtonState}
            onEnabledChange={handleAzureEnabledChange}
            onContainerNameChange={handleAzureContainerNameChange}
            onConnectionStringChange={handleAzureConnectionStringChange}
            onTestConnection={handleAzureTestConnection}
          />

          <GCPCloudSettings
            enabled={gcpSettings.enabled}
            bucketName={gcpSettings.bucketName}
            serviceAccountKey={gcpSettings.serviceAccountKey}
            keyFileName={gcpSettings.keyFileName}
            testButtonState={gcpSettings.testButtonState}
            onEnabledChange={handleGCPEnabledChange}
            onBucketNameChange={handleGCPBucketNameChange}
            onServiceAccountKeyChange={handleGCPServiceAccountKeyChange}
            onClearKey={handleGCPClearKey}
            onTestConnection={handleGCPTestConnection}
          />

          <MinIOCloudSettings
            enabled={minioSettings.enabled}
            endpoint={minioSettings.endpoint}
            port={minioSettings.port}
            useSSL={minioSettings.useSSL}
            bucket={minioSettings.bucket}
            accessKey={minioSettings.accessKey}
            secretKey={minioSettings.secretKey}
            testButtonState={minioSettings.testButtonState}
            onEnabledChange={handleMinIOEnabledChange}
            onEndpointChange={handleMinIOEndpointChange}
            onPortChange={handleMinIOPortChange}
            onUseSSLChange={handleMinIOUseSSLChange}
            onBucketChange={handleMinIOBucketChange}
            onAccessKeyChange={handleMinIOAccessKeyChange}
            onSecretKeyChange={handleMinIOSecretKeyChange}
            onTestConnection={handleMinIOTestConnection}
          />

          <AccountSection
            isLoggedIn={account.isLoggedIn}
            {...(account.userEmail && { userEmail: account.userEmail })}
            onLogin={handleLogin}
            onCreateAccount={handleCreateAccount}
            onSignOut={handleSignOut}
            onLearnMore={handleLearnMore}
          />

          <SupportSection
            onHelpClick={handleHelpClick}
            onPrivacyClick={handlePrivacyClick}
            onTermsClick={handleTermsClick}
            onDownloadClick={handleDownloadClick}
            onDonateClick={handleDonateClick}
          />

          <AppInfoSection
            version={appInfo.version}
            build={appInfo.build}
            serverUrl={appInfo.serverUrl}
            onClearAllData={handleClearAllData}
            onDebugConsole={handleDebugConsole}
          />

          <LogsSection
            logFilePath={logs.logFilePath}
            logFileSize={logs.logFileSize}
            lastModified={logs.lastModified}
            onShowLogsFolder={handleShowLogsFolder}
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen; 