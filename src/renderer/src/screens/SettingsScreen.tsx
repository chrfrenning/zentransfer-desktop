import React, { useState, useEffect } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import PreferencesSection from '../components/PreferencesSection';
import AWSCloudSettings, { CloudSettingsChangeNotification } from '../components/AWSCloudSettings';
import AzureCloudSettings, { AzureCloudSettingsChangeNotification } from '../components/AzureCloudSettings';
import GCPCloudSettings, { GCPCloudSettingsChangeNotification } from '../components/GCPCloudSettings';
import MinIOCloudSettings, { MinIOCloudSettingsChangeNotification } from '../components/MinIOCloudSettings';
import AccountSection from '../components/AccountSection';
import SupportSection from '../components/SupportSection';
import AppInfoSection from '../components/AppInfoSection';
import LogsSection from '../components/LogsSection';
import { getElectronAPI } from '../api/ZenTransferAPI';
import { SettingChangeNotification } from '../components/PreferenceSetting';

// Cloud settings change notification union type
type CloudChangeNotification = 
  | CloudSettingsChangeNotification 
  | AzureCloudSettingsChangeNotification 
  | GCPCloudSettingsChangeNotification 
  | MinIOCloudSettingsChangeNotification;

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
          <PreferencesSection onChange={handlePreferenceChange} />

          <AWSCloudSettings onChange={handleCloudSettingsChange} />

          <AzureCloudSettings onChange={handleCloudSettingsChange} />

          <GCPCloudSettings onChange={handleCloudSettingsChange} />

          <MinIOCloudSettings onChange={handleCloudSettingsChange} />

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