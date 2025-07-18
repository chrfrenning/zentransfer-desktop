import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoaderScreen from './screens/LoaderScreen';
import LoginScreen from './screens/LoginScreen';
import MainInterface from './screens/MainInterface';
import DownloadMonitor from './components/DownloadMonitor';
import { getElectronAPI } from './api/ZenTransferAPI';
import './RendererLogger';

// Component that handles the authentication logic and routing
const AppRouter: React.FC = () => {
  const [isElectronReady, setIsElectronReady] = useState<boolean>(false);
  const [appVersion, setAppVersion] = useState<string>('Loading...');
  const [isDevelopmentMode, setIsDevelopmentMode] = useState<boolean>(false);
  const [versionCheckPassed, setVersionCheckPassed] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authCheckComplete, setAuthCheckComplete] = useState<boolean>(false);
  const [initialRouteReady, setInitialRouteReady] = useState<boolean>(false);

  const api = getElectronAPI();
  const navigate = useNavigate();

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

  // Handle initial routing after auth check is complete
  useEffect(() => {
    if (authCheckComplete && !initialRouteReady) {
      setInitialRouteReady(true);
      
      if (isAuthenticated) {
        navigate('/');
      } else {
        navigate('/login');
      }
    }
  }, [authCheckComplete, isAuthenticated, initialRouteReady, navigate]);

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
    navigate('/');
  };

  const handleLogout = (): void => {
    console.log('Logout requested - updating authentication state');
    setIsAuthenticated(false);
    navigate('/login');
  };

  const handleRequestLogin = (): void => {
    console.log('Login requested - navigating to login screen');
    navigate('/login');
  };

  const handleSkipLogin = (): void => {
    console.log('Login skipped - proceeding to main app without authentication');
    setIsAuthenticated(true);
    navigate('/');
  };

  // Show basic loading if Electron is not ready
  if (!isElectronReady) {
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

  return (
    <Routes>
      <Route 
        path="/loader" 
        element={<LoaderScreen onVersionCheckComplete={handleVersionCheckComplete} />} 
      />
      <Route 
        path="/login" 
        element={<LoginScreen onLoginSuccess={handleLoginSuccess} onSkipLogin={handleSkipLogin} />} 
      />
      <Route 
        path="/" 
        element={
          <MainInterface 
            onLogout={handleLogout} 
            onRequestLogin={handleRequestLogin} 
          />
        } 
      />
      
      {/* Default route handling */}
      <Route 
        path="*" 
        element={
          !versionCheckPassed ? (
            <Navigate to="/loader" replace />
          ) : !authCheckComplete ? (
            // Show loading while checking authentication
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
          ) : !versionCheckPassed ? (
            // Version check failed
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
          ) : (
            <Navigate to="/" replace />
          )
        } 
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      {/* Persistent download monitor - always active for background download management */}
      <DownloadMonitor />
      <AppRouter />
    </Router>
  );
};

export default App; 