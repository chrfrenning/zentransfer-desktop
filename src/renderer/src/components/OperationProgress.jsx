import React from 'react';
import OverallProgress from './OverallProgress';

const OperationProgress = ({ 
  queued = 0,
  uploading = 0,
  completed = 0, 
  failed = 0, 
  operationType = "operation",
  onViewLog = null 
}) => {
  const total = queued + uploading + completed + failed;
  const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
  
  // Determine the operation state
  const isCompleted = queued === 0 && uploading === 0 && total > 0;
  const hasFailures = failed > 0;
  const isFullSuccess = isCompleted && failed === 0;
  const isPartialSuccess = isCompleted && hasFailures;

  const getProgressBarColor = () => {
    if (isFullSuccess) return 'green';
    if (isPartialSuccess) return 'yellow';
    return 'blue';
  };

  const getStatusIcon = () => {
    if (isFullSuccess) {
      return (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            {operationType.charAt(0).toUpperCase() + operationType.slice(1)} Completed Successfully!
          </h3>
          <p className="text-sm text-green-600">
            All {completed} files processed successfully
          </p>
        </div>
      );
    }

    if (isPartialSuccess) {
      return (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            {operationType.charAt(0).toUpperCase() + operationType.slice(1)} Completed with Issues
          </h3>
          <p className="text-sm text-yellow-600">
            {completed} succeeded, {failed} failed
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full">
      {/* Stats Grid */}
      <div className="flex w-full gap-3 mb-6">
        <div className="flex-1 text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="font-semibold text-2xl text-blue-600">{queued}</div>
          <div className="text-sm text-gray-600">Queued</div>
        </div>
        <div className="flex-1 text-center p-4 bg-amber-50 rounded-lg border border-amber-100">
          <div className="font-semibold text-2xl text-amber-600">{uploading}</div>
          <div className="text-sm text-gray-600">Processing</div>
        </div>
        <div className="flex-1 text-center p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="font-semibold text-2xl text-green-600">{completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="flex-1 text-center p-4 bg-red-50 rounded-lg border border-red-100">
          <div className="font-semibold text-2xl text-red-600">{failed}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
      </div>

      {/* Overall Progress Bar */}
      {total > 0 && (
        <OverallProgress 
          progress={progress}
          color={getProgressBarColor()}
        />
      )}

      {/* Completion Status */}
      {(isFullSuccess || isPartialSuccess) && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          {getStatusIcon()}
        </div>
      )}

      {/* Log Link - Only show when completed */}
      {isCompleted && onViewLog && (
        <div className="text-center">
          <button 
            onClick={onViewLog}
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline transition-all duration-200 focus:outline-none focus:underline"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            View detailed log
          </button>
        </div>
      )}
    </div>
  );
};

export default OperationProgress; 