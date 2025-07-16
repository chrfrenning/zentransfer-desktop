import React from 'react';

interface AppInfoSectionProps {
  version: string;
  build: string;
  serverUrl: string;
  onClearAllData: () => void;
  onDebugConsole: () => void;
}

const AppInfoSection: React.FC<AppInfoSectionProps> = ({
  version,
  build,
  serverUrl,
  onClearAllData,
  onDebugConsole,
}) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">App Info</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Version</span>
          <span className="text-sm font-medium text-gray-900">{version}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Build</span>
          <span className="text-sm font-medium text-gray-900">{build}</span>
        </div>
        <div className="flex items-center justify-between">
          <span 
            className="text-sm text-gray-600 select-none cursor-pointer"
            onClick={onDebugConsole}
          >
            Server
          </span>
          <span className="text-sm font-medium text-gray-900">{serverUrl}</span>
        </div>
        
        <div className="pt-4 border-t border-gray-200 space-y-3">
          <button
            onClick={onClearAllData}
            className="w-full text-left text-sm text-red-600 hover:text-red-700 font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer"
          >
            Clear All Data
          </button>
          <button
            onClick={onDebugConsole}
            className="w-full text-left text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer"
          >
            Debug Console
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppInfoSection; 