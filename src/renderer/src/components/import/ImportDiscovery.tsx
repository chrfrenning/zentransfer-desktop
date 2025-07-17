import React from 'react';
import { Button } from '../catalyst/button';
import { Text } from '../catalyst/text';
import { Heading } from '../catalyst/heading';
import type { DiscoveryStats } from '../../types/import';

interface ImportDiscoveryProps {
  discoveryStats: DiscoveryStats;
  onConfirmImport: () => void;
  onCancel: () => void;
  formatFileSize: (bytes: number) => string;
}

const ImportDiscovery: React.FC<ImportDiscoveryProps> = ({
  discoveryStats,
  onConfirmImport,
  onCancel,
  formatFileSize
}) => {
  const {
    totalFilesInSource,
    filteredOut,
    duplicatesFiltered,
    filesToImport,
    totalSourceSize,
    filteredOutSize,
    duplicateSize,
    importSize
  } = discoveryStats;

  const filteredOutPercentage = totalFilesInSource > 0 
    ? Math.round((filteredOut / totalFilesInSource) * 100) 
    : 0;
  
  const duplicatesPercentage = totalFilesInSource > 0 
    ? Math.round((duplicatesFiltered / totalFilesInSource) * 100) 
    : 0;

  const toImportPercentage = totalFilesInSource > 0 
    ? Math.round((filesToImport / totalFilesInSource) * 100) 
    : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6 text-center">
        <Heading level={1}>Ready... set...</Heading>
      </div>

      {/* Import Summary */}
      <div className="flex-1 min-h-0">
        {/* Beautiful Summary Box */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-center space-x-10">
            {/* Files Count */}
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-500 rounded-full mb-3 mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {filesToImport.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 font-medium whitespace-nowrap">
                Files Selected
              </div>
            </div>

            {/* Divider */}
            <div className="w-px h-16 bg-blue-200"></div>

            {/* Size */}
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-3 mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">
                {formatFileSize(importSize)}
              </div>
              <div className="text-sm text-gray-600 font-medium whitespace-nowrap">
                Total Size
              </div>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
          <div className="space-y-2">
            <div className="flex text-sm text-gray-600">
              <span className="flex-1">Files to import</span>
              <span className="flex-1 text-center">Filtered out</span>
              <span className="flex-1 text-right">Duplicates</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div className="h-full flex">
                <div 
                  className="bg-blue-500" 
                  style={{ width: `${toImportPercentage}%` }}
                  title={`${filesToImport} files to import (${toImportPercentage}%)`}
                />
                <div 
                  className="bg-yellow-400" 
                  style={{ width: `${filteredOutPercentage}%` }}
                  title={`${filteredOut} files filtered out (${filteredOutPercentage}%)`}
                />
                <div 
                  className="bg-red-400" 
                  style={{ width: `${duplicatesPercentage}%` }}
                  title={`${duplicatesFiltered} duplicate files (${duplicatesPercentage}%)`}
                />
              </div>
            </div>
            <div className="flex text-xs text-gray-500">
              <span className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded mr-1"></div>
                Import ({toImportPercentage}%)
              </span>
              <span className="flex items-center ml-4">
                <div className="w-3 h-3 bg-yellow-400 rounded mr-1"></div>
                Filtered ({filteredOutPercentage}%)
              </span>
              <span className="flex items-center ml-4">
                <div className="w-3 h-3 bg-red-400 rounded mr-1"></div>
                Duplicates ({duplicatesPercentage}%)
              </span>
            </div>
          </div>
        </div>

        {/* Cancel Link */}
        <div className="text-center mb-6">
          <button 
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            Cancel - Back to Settings
          </button>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex-shrink-0 pt-4 border-t border-gray-200">
        <Button 
          color="blue" 
          onClick={onConfirmImport}
          disabled={filesToImport === 0}
          className="w-full"
        >
          Go! Import {filesToImport.toLocaleString()} files
        </Button>
      </div>
    </div>
  );
};

export default ImportDiscovery; 