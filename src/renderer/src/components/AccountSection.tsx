import React from 'react';
import { Button } from './catalyst/button';

interface AccountSectionProps {
  isLoggedIn: boolean;
  userEmail?: string;
  onLogin: () => void;
  onCreateAccount: () => void;
  onSignOut: () => void;
  onLearnMore: () => void;
}

const AccountSection: React.FC<AccountSectionProps> = ({
  isLoggedIn,
  userEmail,
  onLogin,
  onCreateAccount,
  onSignOut,
  onLearnMore,
}) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">ZenTransfer.io account</h3>
      
      {isLoggedIn ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium text-gray-900">{userEmail || 'Unknown'}</span>
          </div>
          <Button
            color="red"
            onClick={onSignOut}
            className="w-full"
          >
            Sign Out
          </Button>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Log in to relay files via ZenTransfer.io.
          </div>
          <Button
            color="blue"
            onClick={onLogin}
            className="w-full"
          >
            Log In
          </Button>
          <Button
            outline
            onClick={onCreateAccount}
            className="w-full"
          >
            Create New Account
          </Button>
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