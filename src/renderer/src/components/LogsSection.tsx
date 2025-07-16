import React from 'react';
import { Button } from './catalyst/button';
import { DocumentTextIcon, FolderOpenIcon } from '@heroicons/react/24/outline';

interface LogsSectionProps {
  logFilePath: string;
  logFileSize: string;
  lastModified: string;
  onShowLogsFolder: () => void;
}

const LogsSection: React.FC<LogsSectionProps> = ({
  logFilePath,
  logFileSize,
  lastModified,
  onShowLogsFolder,
}) => {
  // Extract just the filename from the full path for cleaner display
  const fileName = logFilePath.split(/[\\\/]/).pop() || logFilePath;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
        <DocumentTextIcon className="w-5 h-5 mr-2 text-blue-500" />
        Application Logs
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Application logs help diagnose issues and track application behavior. Logs are automatically managed and kept for 30 days.
      </p>
      
      <div className="space-y-3 mb-6 text-sm text-gray-500">
        <div className="flex justify-between">
          <span>Log file:</span>
          <span className="font-mono text-xs" title={logFilePath}>
            {fileName}
          </span>
        </div>
        <div className="flex justify-between">
          <span>File size:</span>
          <span>{logFileSize}</span>
        </div>
        <div className="flex justify-between">
          <span>Last updated:</span>
          <span>{lastModified}</span>
        </div>
      </div>
      
      <Button
        color="blue"
        onClick={onShowLogsFolder}
        className="w-full flex items-center justify-center space-x-2"
      >
        <FolderOpenIcon className="w-5 h-5" />
        <span>Show Logs Folder</span>
      </Button>
    </div>
  );
};

export default LogsSection; 