import React from 'react';
import { Button } from '../catalyst/button';
import { Heading } from '../catalyst/heading';
import { Text } from '../catalyst/text';
import FileList from '../FileList';
import OperationProgress from '../OperationProgress';
import type { ImportFile, ImportStats, ImportProgressData } from '../../types/import';

interface ImportProgressProps {
  files: ImportFile[];
  stats: ImportStats;
  progressData: ImportProgressData;
  onCancel: () => void;
  formatFileSize: (size: number) => string;
}

const ImportProgress: React.FC<ImportProgressProps> = ({
  files,
  stats,
  progressData,
  onCancel,
  formatFileSize
}) => {
  const totalFiles = stats.discovered + stats.queued + stats.processing + stats.completed + stats.failed + stats.skipped;
  const processedFiles = stats.completed + stats.failed + stats.skipped;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Compact Header with status and stop button */}
      <div className="flex items-center justify-between mt-2 mb-6 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 mr-3">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-md">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <Heading level={2} className="text-lg leading-tight">Import</Heading>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            </div>
            <Text className="text-sm text-purple-600 leading-tight">Import in progress</Text>
          </div>
        </div>
        <Button color="red" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Current File Progress */}
      {progressData.currentFile && (
        <div className="mb-6">
          <div className="flex justify-between items-center text-sm text-gray-600 mb-3">
            <div className="flex-1 min-w-0">
              <span className="font-medium">Current File:</span>
              <span className="ml-2 truncate text-gray-900" title={progressData.currentFile.name}>
                {progressData.currentFile.name}
              </span>
            </div>
            <span className="ml-4 flex-shrink-0">{progressData.currentFileProgress}%</span>
          </div>
          
          {progressData.currentDestination && (
            <div className="text-xs text-gray-500 mb-2">
              Destination: {progressData.currentDestination}
            </div>
          )}
          
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-green-600 h-3 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progressData.currentFileProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Overall Progress using OperationProgress component */}
      <OperationProgress
        queued={stats.queued}
        uploading={stats.processing}
        completed={stats.completed}
        failed={stats.failed}
        operationType="import"
        hideWhenCompleted={false}
      />

      {/* Additional Stats */}
      {/* <div className="mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Discovered</div>
            <div className="text-2xl font-semibold text-gray-900">{stats.discovered}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Skipped</div>
            <div className="text-2xl font-semibold text-gray-900">{stats.skipped}</div>
          </div>
        </div>
      </div> */}

      {/* Progress Details */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Progress:</span>
            <span>{processedFiles} of {totalFiles} files</span>
          </div>
          <div className="flex justify-between">
            <span>Data processed:</span>
            <span>{formatFileSize(stats.processedSize)} of {formatFileSize(stats.totalSize)}</span>
          </div>
          {progressData.transferSpeed && (
            <div className="flex justify-between">
              <span>Speed:</span>
              <span>{formatFileSize(progressData.transferSpeed)}/s</span>
            </div>
          )}
          {progressData.estimatedTimeRemaining && (
            <div className="flex justify-between">
              <span>Time remaining:</span>
              <span>{Math.ceil(progressData.estimatedTimeRemaining / 60)} min</span>
            </div>
          )}
        </div>
      </div>

      {/* File List - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <FileList files={files.map(file => ({
          id: file.id,
          name: file.name,
          size: file.size,
          type: file.type,
          path: file.path,
          source: file.source,
          status: file.status === 'processing' ? 'uploading' : 
                  file.status === 'completed' ? 'completed' :
                  file.status === 'failed' ? 'failed' :
                  undefined,
          progress: file.progress,
          error: file.error,
          lastModified: file.lastModified
        }))} formatFileSize={formatFileSize} />
      </div>
    </div>
  );
};

export default ImportProgress; 