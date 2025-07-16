import React, { useState } from 'react';
import ImportScreen from './ImportScreen';
import UploadScreen from './UploadScreen';
import DownloadScreen from './DownloadScreen';
import SettingsScreen from './SettingsScreen';

interface MainInterfaceProps {
  onLogout: () => void;
  onRequestLogin: () => void;
}

const MainInterface: React.FC<MainInterfaceProps> = ({ onLogout, onRequestLogin }) => {
  const [activeTab, setActiveTab] = useState<string>('import');

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
        return <SettingsScreen onLogout={onLogout} onRequestLogin={onRequestLogin} />;
      default:
        return <ImportScreen />;
    }
  };

  return (
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
  );
};

export default MainInterface; 