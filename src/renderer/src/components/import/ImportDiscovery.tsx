import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../catalyst/button';
import { Text } from '../catalyst/text';
import { Heading } from '../catalyst/heading';
import type { DiscoveryStats, ImportSettings } from '../../types/import';

interface ImportDiscoveryProps {
  discoveryStats: DiscoveryStats;
  settings: Partial<ImportSettings>;
  onConfirmImport: () => void;
  onCancel: () => void;
  onSettingsChange: (updates: Partial<ImportSettings>) => void;
  formatFileSize: (bytes: number) => string;
}

const ImportDiscovery: React.FC<ImportDiscoveryProps> = ({
  discoveryStats,
  settings,
  onConfirmImport,
  onCancel,
  onSettingsChange,
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

  // Auto-start countdown state
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showTimerDropdown, setShowTimerDropdown] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Timer options
  const timerOptions = [
    { value: 0, label: 'Disabled' },
    { value: 10, label: '10 seconds' },
    { value: 20, label: '20 seconds' },
    { value: 30, label: '30 seconds' },
    { value: 45, label: '45 seconds' },
    { value: 60, label: '60 seconds' },
    { value: 90, label: '90 seconds' }
  ];

  // Initialize countdown if auto-start is enabled
  useEffect(() => {
    const autoStartSecs = settings.autoStartJobInSecs || 0;
    if (autoStartSecs > 0) {
      setCountdown(autoStartSecs);
    }
  }, [settings.autoStartJobInSecs]);

  // Handle countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdown === 0) {
        onConfirmImport();
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [countdown, onConfirmImport]);

  // Handle clicking outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTimerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCancelCountdown = () => {
    setCountdown(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleTimerChange = (seconds: number) => {
    onSettingsChange({ autoStartJobInSecs: seconds });
    setShowTimerDropdown(false);
    if (seconds > 0) {
      setCountdown(seconds);
    } else {
      handleCancelCountdown();
    }
  };

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
        <div className="text-center mb-4">
          <button 
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            Cancel - Back to Settings
          </button>
        </div>

        {/* Auto-start Countdown */}
        {countdown !== null && countdown > 0 && (
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-2">
              <span className="text-sm text-gray-600">
                Auto-starting in {countdown} second{countdown !== 1 ? 's' : ''}
              </span>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowTimerDropdown(!showTimerDropdown)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Change timer setting"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showTimerDropdown && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-32">
                    {timerOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleTimerChange(option.value)}
                        className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                          settings.autoStartJobInSecs === option.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timer Settings for when countdown is not active */}
        {(countdown === null || countdown <= 0) && settings.autoStartJobInSecs === 0 && (
          <div className="text-center mb-6">
            <div className="relative inline-block" ref={dropdownRef}>
              <button
                onClick={() => setShowTimerDropdown(!showTimerDropdown)}
                className="text-gray-500 hover:text-gray-700 text-sm underline inline-flex items-center space-x-1"
              >
                <span>Enable auto-start</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showTimerDropdown && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-32">
                  {timerOptions.filter(opt => opt.value > 0).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleTimerChange(option.value)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-gray-700"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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