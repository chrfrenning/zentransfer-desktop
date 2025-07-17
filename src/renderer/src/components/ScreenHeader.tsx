import React from 'react';

export type ScreenMode = 'import' | 'upload' | 'download' | 'settings';

export interface ScreenHeaderProps {
  readonly mode?: ScreenMode;
}

export interface ModeConfig {
  readonly title: string;
  readonly description: string;
  readonly color: string;
  readonly icon: React.ReactNode;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ mode = 'import' }) => {
  // Define configuration for each mode
  const modeConfig: Record<ScreenMode, ModeConfig> = {
    import: {
      title: 'Import',
      description: 'Import from SD/CF cards or folders',
      color: 'bg-purple-500',
      icon: (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </>
      )
    },
    upload: {
      title: 'Upload',
      description: 'Upload to your cloud storage',
      color: 'bg-blue-500',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
      )
    },
    download: {
      title: 'Download',
      description: 'Monitor for new files on ZenTransfer.io',
      color: 'bg-green-500',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      )
    },
    settings: {
      title: 'Settings',
      description: 'Preferences and cloud services',
      color: 'bg-gray-500',
      icon: (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </>
      )
    }
  };

  // Get current mode configuration (default to import if mode not found)
  const config = modeConfig[mode as ScreenMode] || modeConfig.import;

  return (
    <div className="flex items-center mt-2 mb-6 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex-shrink-0 mr-6">
        <div className={`w-8 h-8 ${config.color} rounded-full flex items-center justify-center shadow-md`}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {config.icon}
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold text-gray-900 leading-tight">{config.title}</h2>
        <p className="text-sm text-gray-600 leading-tight">{config.description}</p>
      </div>
    </div>
  );
};

export default ScreenHeader; 