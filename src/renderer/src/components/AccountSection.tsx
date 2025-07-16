import React from 'react';

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
          <button
            onClick={onSignOut}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-md transition-colors duration-200"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Log in to relay files via ZenTransfer.io.
          </div>
          <button
            onClick={onLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-md transition-colors duration-200"
          >
            Log In
          </button>
          <button
            onClick={onCreateAccount}
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