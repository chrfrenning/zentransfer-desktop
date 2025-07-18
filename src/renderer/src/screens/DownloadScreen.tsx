import React, { useState, useEffect } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import { Button } from '../components/catalyst/button';
import { Text } from '../components/catalyst/text';
import { Heading } from '../components/catalyst/heading';
import FolderSelector from '../components/import/FolderSelector';
import { useDownloadStore } from '../stores/DownloadStore';
import { getElectronAPI } from '../api/ZenTransferAPI';

const DownloadScreen = () => {
  const [downloadPath, setDownloadPath] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState('Never');
  const [isStarting, setIsStarting] = useState(false);

  // Download store
  const {
    files,
    stats,
    isMonitoring,
    setMonitoring,
    setLastSyncTime: setStoreLastSyncTime,
    addFiles,
    updateFileStatus,
    updateFileProgress
  } = useDownloadStore();

  // Set up download message listeners with console logging
  useEffect(() => {
    const electronAPI = getElectronAPI();
    
    console.log('🔄 Setting up download message listeners...');
    
    // Set up progress listener
    const progressCleanup = electronAPI.download.onProgress((progressData) => {
      console.log('📈 Download Progress:', progressData);
      
      const { fileRecord, downloadedBytes, totalBytes } = progressData;
      
      // Calculate progress percentage
      const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
      
      // Update store
      updateFileProgress(fileRecord.file_id, progress, downloadedBytes, totalBytes);
      
      console.log(`📈 Updated progress for ${fileRecord.name}: ${progress}% (${downloadedBytes}/${totalBytes} bytes)`);
    });
    
    // Set up completed listener
    const completedCleanup = electronAPI.download.onCompleted((completedData) => {
      console.log('✅ Download Completed:', completedData);
      
      const { fileRecord, filePath } = completedData;
      
      // Update store
      updateFileStatus(fileRecord.file_id, 'completed', 100);
      
      console.log(`✅ Completed download: ${fileRecord.name} -> ${filePath}`);
    });
    
    // Set up error listener
    const errorCleanup = electronAPI.download.onError((errorData) => {
      console.log('❌ Download Error:', errorData);
      
      const { fileRecord, errorMessage } = errorData;
      
      // Update store
      updateFileStatus(fileRecord.file_id, 'failed', 0, errorMessage);
      
      console.log(`❌ Failed download: ${fileRecord.name} - Error: ${errorMessage}`);
    });
    
    console.log('✅ Download message listeners configured');
    
    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up download message listeners...');
      progressCleanup();
      completedCleanup();
      errorCleanup();
    };
  }, [updateFileStatus, updateFileProgress]);

  // Handle reset sync
  const handleResetSync = async () => {
    if (confirm('Reset sync time? This will re-download all files from the beginning.')) {
      try {
        const electronAPI = getElectronAPI();
        await electronAPI.download.resetSyncTime(0);
        setLastSyncTime('Never');
        setStoreLastSyncTime('Never');
        console.log('🔄 Sync time reset');
      } catch (error) {
        console.error('Failed to reset sync time:', error);
        alert('Failed to reset sync time');
      }
    }
  };

  // Handle start monitoring
  const handleStartMonitoring = async () => {
    if (!downloadPath) {
      alert('Please set a download directory first');
      return;
    }
    
    setIsStarting(true);
    
    try {
      const electronAPI = getElectronAPI();
      
      console.log('🚀 Starting download monitoring...');
      await electronAPI.download.startMonitoring();
      
      setMonitoring(true);
      const now = new Date().toLocaleString();
      setLastSyncTime(now);
      setStoreLastSyncTime(now);
      
      console.log('✅ Download monitoring started successfully');
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error);
      alert('Failed to start download monitoring');
    } finally {
      setIsStarting(false);
    }
  };

  // Handle stop monitoring
  const handleStopMonitoring = async () => {
    try {
      const electronAPI = getElectronAPI();
      
      console.log('🛑 Stopping download monitoring...');
      await electronAPI.download.stopMonitoring();
      
      setMonitoring(false);
      
      console.log('✅ Download monitoring stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop monitoring:', error);
      alert('Failed to stop download monitoring');
    }
  };

  // Handle folder selection
  const handleFolderChange = (path: string) => {
    setDownloadPath(path);
    console.log('📁 Download path selected:', path);
  };

  // Remove file from list
  const handleRemoveFile = (fileId: string | number) => {
    const file = files.find(f => f.file_id === fileId);
    if (file && (file.status === 'completed' || file.status === 'failed')) {
      if (confirm(`Remove "${file.name}" from list?`)) {
        // Note: We don't have a removeFile action in the store yet, but we could add it
        console.log(`🗑️ Would remove file: ${file.name}`);
      }
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Get status classes
  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      case 'downloading': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string): JSX.Element => {
    switch (status) {
      case 'queued':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
      case 'downloading':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>;
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        );
      default:
        return <></>;
    }
  };

  // Get border class for thumbnails
  const getStatusBorderClass = (status: string): string => {
    switch (status) {
      case 'queued': return 'border-yellow-300';
      case 'downloading': return 'border-blue-500';
      case 'completed': return 'border-green-500';
      case 'failed': return 'border-red-500';
      default: return 'border-gray-300';
    }
  };

  // Sort files for display
  const sortedFiles = files
    .filter(file => file.status === 'downloading' || file.status === 'completed' || file.status === 'failed')
    .sort((a, b) => {
      const statusPriority = { queued: 0, downloading: 1, completed: 2, failed: 3 };
      const aPriority = statusPriority[a.status] || 4;
      const bPriority = statusPriority[b.status] || 4;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      if (a.status === 'downloading') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      } else {
        return (b.completedAt || b.addedAt || 0) - (a.completedAt || a.addedAt || 0);
      }
    });

  if (!isMonitoring) {
    // Setup Mode
    return (
      <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
        <div className="w-full">
          {/* Compact Header */}
          <div className="flex items-center mt-2 mb-6 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex-shrink-0 mr-6">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Heading level={2} className="text-lg leading-tight">Download</Heading>
              <Text className="text-sm leading-tight">Monitor and download from ZenTransfer.io</Text>
            </div>
          </div>

          {/* Settings */}
          <div className="max-w-2xl space-y-6">
            {/* Download Path */}
            <FolderSelector
              label="Download files to"
              value={downloadPath}
              onChange={handleFolderChange}
              type="destination"
              placeholder="Select download directory..."
              required={true}
            />

            {/* Last Sync */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Text className="text-sm font-medium">Last Sync:</Text>
                <Text className="text-sm text-gray-600">{lastSyncTime}</Text>
              </div>
              <button 
                onClick={handleResetSync}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Reset
              </button>
            </div>

            {/* Stats Preview */}
            {stats.queued + stats.downloading + stats.completed + stats.failed > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <Text className="text-sm font-medium mb-2">Current Status</Text>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-600">{stats.queued}</div>
                    <div className="text-xs text-gray-600">Queued</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{stats.downloading}</div>
                    <div className="text-xs text-gray-600">Downloading</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{stats.completed}</div>
                    <div className="text-xs text-gray-600">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">{stats.failed}</div>
                    <div className="text-xs text-gray-600">Failed</div>
                  </div>
                </div>
              </div>
            )}

            {/* Console Logging Info */}
            <div className="text-xs text-gray-600 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="font-medium mb-1">Console Logging Active:</p>
              <p>Open browser dev tools (F12) → Console tab to see detailed download events</p>
            </div>

            {/* Start Button */}
            <Button 
              color="green"
              className="w-full"
              onClick={handleStartMonitoring}
              disabled={!downloadPath || isStarting}
            >
              {isStarting ? 'Starting...' : 'Start Monitoring'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Monitoring Mode
  return (
    <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
      <div className="w-full">
        
        {/* Compact Header with status and stop button */}
        <div className="flex items-center justify-between mt-2 mb-6 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 mr-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <Heading level={2} className="text-lg leading-tight">Download</Heading>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <Text className="text-sm text-green-600 leading-tight">
                Monitoring active • {files.length} files
              </Text>
            </div>
          </div>
          <Button color="red" onClick={handleStopMonitoring}>
            Stop
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-white rounded border">
            <div className="text-2xl font-bold text-yellow-600">{stats.queued}</div>
            <div className="text-sm text-gray-600">Queued</div>
          </div>
          <div className="text-center p-3 bg-white rounded border">
            <div className="text-2xl font-bold text-blue-600">{stats.downloading}</div>
            <div className="text-sm text-gray-600">Downloading</div>
          </div>
          <div className="text-center p-3 bg-white rounded border">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="text-center p-3 bg-white rounded border">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>

        {/* File List */}
        <div className="bg-white rounded-lg border overflow-hidden mb-6">
          <div className="divide-y divide-gray-200">
            {sortedFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <Text>No files in queue</Text>
                <Text className="text-sm">Files will appear here when detected</Text>
              </div>
            ) : (
              sortedFiles.map(file => (
                <div 
                  key={file.file_id} 
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRemoveFile(file.file_id)}
                >
                  <div className="flex items-center space-x-4">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border-2 ${getStatusBorderClass(file.status)}`}>
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <Text className="text-sm font-medium truncate">{file.name}</Text>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(file.status)}`}>
                          {file.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        <Text className="text-xs text-gray-500">{formatFileSize(file.size)}</Text>
                        <Text className="text-xs text-gray-500">{file.type.split('/')[0] || 'Unknown'}</Text>
                        {file.created && (
                          <Text className="text-xs text-gray-500">{new Date(file.created).toLocaleDateString()}</Text>
                        )}
                      </div>
                      {file.status === 'downloading' && file.progress !== undefined && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{file.progress.toFixed(0)}%</span>
                            <span>{formatFileSize(file.downloadedBytes || 0)} / {formatFileSize(file.totalBytes || file.size)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${file.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      {file.error && (
                        <Text className="text-xs text-red-600 mt-1">{file.error}</Text>
                      )}
                    </div>
                    
                    {/* Status Indicator */}
                    <div className="flex-shrink-0">
                      {getStatusIcon(file.status)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadScreen;