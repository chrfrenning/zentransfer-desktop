import React, { useState, useEffect } from 'react';
import LoaderScreen from './screens/LoaderScreen';
import './RendererLogger';

// Import contexts and providers (will be created in later phases)
// import { AppProvider } from './contexts/AppContext';

const App = () => {
  const [isElectronReady, setIsElectronReady] = useState(false);
  const [appVersion, setAppVersion] = useState('Loading...');
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [versionCheckPassed, setVersionCheckPassed] = useState(false);

  useEffect(() => {
    // Check if Electron API is available
    if (window.electronAPI) {
      setIsElectronReady(true);
      
      // Get app version and development mode
      const initializeApp = async () => {
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
      
      initializeApp();
    } else {
      console.error('Electron API not available');
    }
  }, []);

  const handleVersionCheckComplete = (shouldProceed) => {
    console.log('Version check completed, should proceed:', shouldProceed);
    setVersionCheckPassed(shouldProceed);
    setShowLoader(false);
    
    if (!shouldProceed) {
      // Handle case where version check failed and app should not proceed
      console.log('App should not proceed due to version check failure');
      // In a real app, you might exit here or show an error screen
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

  return (
    // Future: Wrap with AppProvider when contexts are implemented
    // <AppProvider>
      <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Temporary React UI - will be replaced with actual screens */}
        <div className="h-full flex flex-col items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg">
            <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              <img src="logo_sq.png" alt="ZenTransfer Logo" className="w-16 h-16" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-800 mb-2">ZenTransfer React</h1>
            <p className="text-gray-600 mb-4">Ready to Go!</p>
            
            <div className="space-y-2 text-sm text-gray-500">
              <p>Version: {appVersion}</p>
              <p>Development Mode: {isDevelopmentMode ? 'Yes' : 'No'}</p>
              <p>Electron API: {window.electronAPI ? 'Available' : 'Not Available'}</p>
              <p>Version Check: Passed ✓</p>
            </div>
            
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">✓ LoaderScreen Complete</h3>
              <ul className="text-left text-sm text-green-700 space-y-1">
                <li>• LoaderScreen component created</li>
                <li>• Version checking implemented</li>
                <li>• Visual design matches legacy</li>
                <li>• Integrated into App.jsx</li>
                <li>• Minimum display time enforced</li>
                <li>• Error handling included</li>
              </ul>
            </div>
            
            <div className="mt-4 text-xs text-gray-400">
              Ready for additional screens and features
            </div>
          </div>
        </div>
      </div>
    // </AppProvider>
  );
};

export default App; 