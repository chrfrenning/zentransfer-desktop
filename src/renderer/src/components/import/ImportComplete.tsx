import React from 'react';
import { Button } from '../catalyst/button';
import { Heading } from '../catalyst/heading';
import { Text } from '../catalyst/text';
import type { ImportStats } from '../../types/import';

interface ImportCompleteProps {
  stats: ImportStats;
  onStartNew: () => void;
  onViewFiles?: () => void;
  formatFileSize: (size: number) => string;
}

const ImportComplete: React.FC<ImportCompleteProps> = ({
  stats,
  onStartNew,
  onViewFiles,
  formatFileSize
}) => {
  const totalFiles = stats.discovered + stats.queued + stats.processing + stats.completed + stats.failed + stats.skipped;
  const isFullSuccess = stats.failed === 0 && stats.completed > 0;
  const hasFailures = stats.failed > 0;
  const hasSkipped = stats.skipped > 0;

  const getStatusIcon = () => {
    if (isFullSuccess && !hasSkipped) {
      return (
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
      );
    }

    if (hasFailures) {
      return (
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
      );
    }

    return (
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </div>
    );
  };

  const getStatusMessage = () => {
    if (isFullSuccess && !hasSkipped) {
      return {
        title: 'Import Completed Successfully!',
        description: `All ${stats.completed} files imported successfully`,
        color: 'text-green-800'
      };
    }

    if (hasFailures && stats.completed > 0) {
      return {
        title: 'Import Completed with Issues',
        description: `${stats.completed} files succeeded, ${stats.failed} files failed${hasSkipped ? `, ${stats.skipped} files skipped` : ''}`,
        color: 'text-yellow-800'
      };
    }

    if (hasFailures && stats.completed === 0) {
      return {
        title: 'Import Failed',
        description: `${stats.failed} files failed to import${hasSkipped ? `, ${stats.skipped} files skipped` : ''}`,
        color: 'text-red-800'
      };
    }

    if (hasSkipped && stats.completed > 0) {
      return {
        title: 'Import Completed',
        description: `${stats.completed} files imported, ${stats.skipped} files skipped`,
        color: 'text-blue-800'
      };
    }

    return {
      title: 'Import Completed',
      description: 'Import operation finished',
      color: 'text-gray-800'
    };
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center mt-2 mb-6 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex-shrink-0 mr-6">
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-md">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <Heading level={2} className="text-lg leading-tight">Import</Heading>
          <Text className="text-sm leading-tight">Import completed</Text>
        </div>
      </div>

      {/* Completion Status */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex flex-col items-center justify-center py-6">
          {getStatusIcon()}
          <Heading level={3} className={`text-lg font-semibold ${statusMessage.color} mb-2`}>
            {statusMessage.title}
          </Heading>
          <Text className="text-sm text-gray-600 mb-6 text-center">
            {statusMessage.description}
          </Text>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button onClick={onStartNew} color="purple">
              Import More Files
            </Button>
            {onViewFiles && (
              <Button outline onClick={onViewFiles}>
                View Files
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <Heading level={4} className="text-md font-semibold text-gray-900 mb-4">
          Import Summary
        </Heading>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-semibold text-blue-600">{totalFiles}</div>
            <div className="text-xs text-gray-600">Total Files</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-semibold text-green-600">{stats.completed}</div>
            <div className="text-xs text-gray-600">Completed</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-semibold text-red-600">{stats.failed}</div>
            <div className="text-xs text-gray-600">Failed</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-semibold text-yellow-600">{stats.skipped}</div>
            <div className="text-xs text-gray-600">Skipped</div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Total data size:</span>
            <span className="font-medium">{formatFileSize(stats.totalSize)}</span>
          </div>
          <div className="flex justify-between">
            <span>Data processed:</span>
            <span className="font-medium">{formatFileSize(stats.processedSize)}</span>
          </div>
          <div className="flex justify-between">
            <span>Success rate:</span>
            <span className="font-medium">
              {totalFiles > 0 ? Math.round((stats.completed / totalFiles) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Tips for next import */}
      <div className="bg-gray-50 rounded-lg border p-4">
        <Heading level={5} className="text-sm font-semibold text-gray-900 mb-2">
          💡 Tips for next time
        </Heading>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Ensure source device is properly connected</li>
          <li>• Check available disk space before importing</li>
          <li>• Use backup option for important files</li>
          {hasFailures && <li>• Check file permissions if import fails</li>}
          {hasSkipped && <li>• Review duplicate detection settings if files are skipped</li>}
        </ul>
      </div>
    </div>
  );
};

export default ImportComplete; 