import React, { useState, useEffect } from 'react';
import LoaderScreen from './screens/LoaderScreen';
import LoginScreen from './screens/LoginScreen';
import ImportScreen from './screens/ImportScreen';
import UploadScreen from './screens/UploadScreen';
import DownloadScreen from './screens/DownloadScreen';
import SettingsScreen from './screens/SettingsScreen';
import { getElectronAPI } from './api/ZenTransferAPI';
import './RendererLogger';

// Import contexts and providers (will be created in later phases)
// import { AppProvider } from './contexts/AppContext';

const App: React.FC = () => {
  const [isElectronReady, setIsElectronReady] = useState<boolean>(false);
  const [appVersion, setAppVersion] = useState<string>('Loading...');
  const [isDevelopmentMode, setIsDevelopmentMode] = useState<boolean>(false);
  const [showLoader, setShowLoader] = useState<boolean>(true);
  const [versionCheckPassed, setVersionCheckPassed] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authCheckComplete, setAuthCheckComplete] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('import');

  const api = getElectronAPI();

  useEffect((): void => {
    // Check if Electron API is available
    if (window.electronAPI) {
      setIsElectronReady(true);
      
      // Get app version and development mode
      const initializeApp = async (): Promise<void> => {
        try {
          const version = await window.electronAPI.app.getVersion();
          const devMode = await window.electronAPI.app.getIsDevelopmentMode();
          
          setAppVersion(version);
          setIsDevelopmentMode(devMode);
          
          console.log(`ZenTransfer React v${version} - Development: ${devMode}`);
        } catch (error) {
          console.error('Error initializing React app:', error);
        }
      };
      
      void initializeApp();
    } else {
      console.error('Electron API not available');
    }
  }, []);

  // Check authentication status after version check passes
  useEffect(() => {
    if (versionCheckPassed && !authCheckComplete) {
      checkAuthenticationStatus();
    }
  }, [versionCheckPassed, authCheckComplete]);

  const checkAuthenticationStatus = async (): Promise<void> => {
    try {
      // First check if user has ever attempted to log in
      const token = await api.auth.getToken();
      
      if (token === null) {
        // User has never attempted to log in - skip login and go to main app
        console.log('Authentication status: no previous login attempt - proceeding to main app');
        setIsAuthenticated(true);
      } else {
        // User has a token - check if it's still valid
        const hasValidToken = await api.auth.hasValidToken();
        setIsAuthenticated(hasValidToken);
        console.log('Authentication status:', hasValidToken ? 'authenticated with valid token' : 'token exists but invalid - need to re-login');
      }
    } catch (error) {
      console.error('Failed to check authentication status:', error);
      setIsAuthenticated(false);
    } finally {
      setAuthCheckComplete(true);
    }
  };

  const handleVersionCheckComplete = (shouldProceed: boolean): void => {
    console.log('Version check completed, should proceed:', shouldProceed);
    setVersionCheckPassed(shouldProceed);
    setShowLoader(false);
    
    // If version check passed, we can proceed with the app
    if (shouldProceed) {
      console.log('✅ Version check passed - checking authentication');
    } else {
      console.log('❌ Version check failed - showing update required');
    }
  };

  const handleLoginSuccess = (): void => {
    console.log('Login successful - updating authentication state');
    setIsAuthenticated(true);
  };

  const handleLogout = (): void => {
    console.log('Logout requested - updating authentication state');
    setIsAuthenticated(false);
  };

  const switchTab = (tabName: string): void => {
    setActiveTab(tabName);
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'import':
        return <ImportScreen />;
      case 'upload':
        return <UploadScreen />;
      case 'download':
        return <DownloadScreen />;
      case 'settings':
        return <SettingsScreen onLogout={handleLogout} />;
      default:
        return <ImportScreen />;
    }
  };

  // Show loader screen if it should be shown or if Electron is not ready
  if (!isElectronReady || showLoader) {
    if (showLoader && isElectronReady) {
      return <LoaderScreen onVersionCheckComplete={handleVersionCheckComplete} />;
    } else {
      // Electron not ready - show basic loading
      return (
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-8 flex items-center justify-center">
              <img src="logo_sq.png" alt="ZenTransfer Logo" className="w-16 h-16 border border-gray-300" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">ZenTransfer</h1>
            <p className="text-gray-600 text-lg mb-8">React Version Loading...</p>
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
        </div>
      );
    }
  }

  // If version check didn't pass, show error state
  if (!versionCheckPassed) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg border border-red-200">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <img src="logo_sq.png" alt="ZenTransfer Logo" className="w-16 h-16" />
          </div>
          
          <h1 className="text-3xl font-bold text-red-600 mb-2">Unable to Start</h1>
          <p className="text-red-800 mb-4">The version check did not pass. Please check your connection and try again.</p>
          
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading while checking authentication
  if (!authCheckComplete) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <img src="logo_sq.png" alt="ZenTransfer Logo" className="w-16 h-16" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">ZenTransfer</h1>
          <p className="text-gray-600 mb-6">Checking authentication...</p>
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
          </div>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    // Future: Wrap with AppProvider when contexts are implemented
    // <AppProvider>
      <div className="h-screen flex flex-col">
        {/* Header with Logo */}
        <div className="flex flex-col items-center pt-6 pb-4 bg-white shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mb-3 shadow-lg">
            <img src="logo_sq.png" alt="ZenTransfer" className="w-16 h-16" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">ZenTransfer</h1>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          {renderActiveScreen()}
        </div>

        {/* Bottom Navigation Tabs */}
        <div className="bg-white border-t border-gray-200 px-6 py-2">
          <div className="flex justify-around">
            {/* Import Tab */}
            <button 
              onClick={() => switchTab('import')} 
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-200 ${
                activeTab === 'import' 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <span className="text-xs font-medium">Import</span>
            </button>

            {/* Upload Tab */}
            <button 
              onClick={() => switchTab('upload')} 
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-200 ${
                activeTab === 'upload' 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              <span className="text-xs font-medium">Upload</span>
            </button>

            {/* Download Tab */}
            <button 
              onClick={() => switchTab('download')} 
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-200 ${
                activeTab === 'download' 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span className="text-xs font-medium">Download</span>
            </button>

            {/* Settings Tab */}
            <button 
              onClick={() => switchTab('settings')} 
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-200 ${
                activeTab === 'settings' 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <span className="text-xs font-medium">Settings</span>
            </button>
          </div>
        </div>
      </div>
    // </AppProvider>
  );
};

export default App; 