import React, { useState, useEffect } from 'react';
import { getElectronAPI } from '../../api/ZenTransferAPI';

interface AccountSectionProps {
  onLearnMore: () => void;
  onLogout: () => void;
  onRequestLogin: () => void;
}

const AccountSection: React.FC<AccountSectionProps> = ({ onLearnMore, onLogout, onRequestLogin }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const api = getElectronAPI();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      const hasToken = await api.auth.hasValidToken();
      setIsLoggedIn(hasToken);
      
      if (hasToken) {
        const email = await api.auth.getEmail();
        setUserEmail(email);
      } else {
        setUserEmail(null);
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setIsLoggedIn(false);
      setUserEmail(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    // Login is now handled at the App level - this shouldn't be called when not authenticated
    console.log('Login should be handled at App level');
  };

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await api.auth.logout();
      setIsLoggedIn(false);
      setUserEmail(null);
      // Notify App component about logout
      onLogout();
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleCreateAccount = () => {
    api.shell.openExternal('https://zentransfer.io/register');
  };



  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">ZenTransfer.io account</h3>
      
      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Checking authentication status...</p>
        </div>
      ) : isLoggedIn ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium text-gray-900">{userEmail || 'Unknown'}</span>
          </div>
          <button
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2.5 px-4 rounded-md transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing out...
              </div>
            ) : (
              'Sign Out'
            )}
          </button>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Log in to relay files via ZenTransfer.io.
          </div>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-md transition-colors duration-200"
          >
            Log In
          </button>
          <button
            onClick={handleCreateAccount}
            className="w-full bg-white hover:bg-gray-50 text-gray-900 font-semibold py-2.5 px-4 rounded-md border border-gray-300 hover:border-gray-400 transition-colors duration-200"
          >
            Create New Account
          </button>
          <div className="text-center mt-3">
            <button
              onClick={onLearnMore}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-200 underline bg-transparent border-none cursor-pointer"
            >
              Click to learn more about ZenTransfer.io
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSection; 