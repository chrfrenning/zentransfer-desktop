import React, { useState, useEffect } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import PreferencesSection from '../components/preferences/PreferencesSection';
import AWSCloudSettings, { CloudSettingsChangeNotification } from '../components/preferences/clouds/AWSCloudSettings';
import AzureCloudSettings, { AzureCloudSettingsChangeNotification } from '../components/preferences/clouds/AzureCloudSettings';
import GCPCloudSettings, { GCPCloudSettingsChangeNotification } from '../components/preferences/clouds/GCPCloudSettings';
import MinIOCloudSettings, { MinIOCloudSettingsChangeNotification } from '../components/preferences/clouds/MinIOCloudSettings';
import AccountSection from '../components/preferences/AccountSection';
import AutosortSection, { AutosortChangeNotification } from '../components/preferences/AutosortSection';
import SignWithCertificateSection, { SignWithCertificateChangeNotification } from '../components/preferences/SignWithCertificateSection';
import SignWithPGPSection, { SignWithPGPChangeNotification } from '../components/preferences/SignWithPGPSection';
import CreateLedgerSection, { CreateLedgerChangeNotification } from '../components/preferences/CreateLedgerSection';
import SupportSection from '../components/preferences/SupportSection';
import AppInfoSection from '../components/preferences/AppInfoSection';
import LogsSection from '../components/preferences/LogsSection';
import { getElectronAPI } from '../api/ZenTransferAPI';
import { SettingChangeNotification } from '../components/preferences/PreferenceSetting';

// Cloud settings change notification union type
type CloudChangeNotification = 
  | CloudSettingsChangeNotification 
  | AzureCloudSettingsChangeNotification 
  | GCPCloudSettingsChangeNotification 
  | MinIOCloudSettingsChangeNotification;

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

interface SettingsScreenProps {
  onLogout: () => void;
  onRequestLogin: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout, onRequestLogin }) => {
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

  // Change notification handlers (optional - for logging or analytics)
  const handlePreferenceChange = (notification: SettingChangeNotification) => {
    console.log('Preference changed:', notification);
    // Could emit to analytics, logging, etc.
  };

  const handleCloudSettingsChange = (notification: CloudChangeNotification) => {
    console.log('Cloud settings changed:', notification);
    // Could emit to analytics, logging, etc.
  };

  const handleAutosortChange = (notification: AutosortChangeNotification) => {
    console.log('Autosort settings changed:', notification);
    // Could emit to analytics, logging, etc.
  };

  const handleSignWithCertificateChange = (notification: SignWithCertificateChangeNotification) => {
    console.log('Sign with Certificate settings changed:', notification);
    // Could emit to analytics, logging, etc.
  };

  const handleSignWithPGPChange = (notification: SignWithPGPChangeNotification) => {
    console.log('Sign with PGP settings changed:', notification);
    // Could emit to analytics, logging, etc.
  };

  const handleCreateLedgerChange = (notification: CreateLedgerChangeNotification) => {
    console.log('Create Ledger settings changed:', notification);
    // Could emit to analytics, logging, etc.
  };

  const handleLearnMore = () => {
    openExternal('https://zentransfer.io');
  };

  // Support handlers
  const handleHelpClick = () => {
    openExternal('https://zentransfer.io/faq');
  };

  const handlePrivacyClick = () => {
    openExternal('https://zentransfer.io/privacy-policy');
  };

  const handleTermsClick = () => {
    openExternal('https://zentransfer.io/terms-of-service');
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
          <PreferencesSection onChange={handlePreferenceChange} />

          <AWSCloudSettings onChange={handleCloudSettingsChange} />

          <AzureCloudSettings onChange={handleCloudSettingsChange} />

          <GCPCloudSettings onChange={handleCloudSettingsChange} />

          <MinIOCloudSettings onChange={handleCloudSettingsChange} />

          <AccountSection
            onLearnMore={handleLearnMore}
            onLogout={onLogout}
            onRequestLogin={onRequestLogin}
          />

          <AutosortSection onChange={handleAutosortChange} />

          <SignWithCertificateSection onChange={handleSignWithCertificateChange} />

          <SignWithPGPSection onChange={handleSignWithPGPChange} />

          <CreateLedgerSection onChange={handleCreateLedgerChange} />

          <SupportSection
            onHelpClick={handleHelpClick}
            onPrivacyClick={handlePrivacyClick}
            onTermsClick={handleTermsClick}
            onDownloadClick={handleDownloadClick}
            onDonateClick={handleDonateClick}
          />

          <LogsSection
            logFilePath={logs.logFilePath}
            logFileSize={logs.logFileSize}
            lastModified={logs.lastModified}
            onShowLogsFolder={handleShowLogsFolder}
          />

          <AppInfoSection
            version={appInfo.version}
            build={appInfo.build}
            serverUrl={appInfo.serverUrl}
            onClearAllData={handleClearAllData}
            onDebugConsole={handleDebugConsole}
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen; 