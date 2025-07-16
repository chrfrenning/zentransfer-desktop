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
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors duration-200 cursor-pointer"
          >
            Clear All Data
          </button>
          <div className="text-center">
            <button
              onClick={onDebugConsole}
              className="text-sm text-blue-600 hover:text-blue-800 underline font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer"
            >
              Open Debug Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppInfoSection; 