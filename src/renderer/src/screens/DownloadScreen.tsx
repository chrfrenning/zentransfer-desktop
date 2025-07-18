import React, { useState, useEffect } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import { Button } from '../components/catalyst/button';
import { Text } from '../components/catalyst/text';
import { Heading } from '../components/catalyst/heading';
import FolderSelector from '../components/import/FolderSelector';
import FileList from '../components/FileList';
import { useDownloadStore } from '../stores/DownloadStore';
import { getElectronAPI } from '../api/ZenTransferAPI';
import { downloadFilesToAppFiles } from '../utils/downloadFileAdapter';

const DownloadScreen = () => {
  const [downloadPath, setDownloadPath] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState('Never');
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Download store
  const {
    files,
    stats,
    isMonitoring,
    setLastSyncTime: setStoreLastSyncTime
  } = useDownloadStore();

  // Load initial download path from configuration
  useEffect(() => {
    const loadDownloadPath = async () => {
      try {
        const electronAPI = getElectronAPI();
        const downloadSettings = await electronAPI.config.get('downloadSettings') as any;
        
        if (downloadSettings && typeof downloadSettings === 'object' && downloadSettings.downloadPath) {
          setDownloadPath(downloadSettings.downloadPath);
          console.log('📁 Loaded download path from config:', downloadSettings.downloadPath);
        } else {
          console.log('📁 No download path configured, using empty path');
        }
      } catch (error) {
        console.error('❌ Failed to load download path from config:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadDownloadPath();
  }, []);

  // Debug logging for monitoring state
  useEffect(() => {
    console.log(`📊 DownloadScreen: isMonitoring = ${isMonitoring}`);
  }, [isMonitoring]);

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
      console.log('📊 Current isMonitoring state before API call:', isMonitoring);
      
      await electronAPI.download.startMonitoring();
      
      const now = new Date().toLocaleString();
      setLastSyncTime(now);
      setStoreLastSyncTime(now);
      
      console.log('✅ Download monitoring API call completed');
      console.log('📊 Current isMonitoring state after API call:', isMonitoring);
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
      
      console.log('✅ Download monitoring stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop monitoring:', error);
      alert('Failed to stop download monitoring');
    }
  };

  // Handle folder selection
  const handleFolderChange = async (path: string) => {
    setDownloadPath(path);
    console.log('📁 Download path selected:', path);
    
    // Save to configuration
    try {
      const electronAPI = getElectronAPI();
      
      // Get current download settings
      const currentSettings = (await electronAPI.config.get('downloadSettings') as any) || {};
      
      // Update with new download path
      const updatedSettings = {
        ...currentSettings,
        downloadPath: path
      };
      
      // Save back to config
      await electronAPI.config.set('downloadSettings', updatedSettings);
      console.log('📁 Saved download path to config:', path);
    } catch (error) {
      console.error('❌ Failed to save download path to config:', error);
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

  // Convert download files to app files for FileList compatibility
  const displayFiles = downloadFilesToAppFiles(files);
  
  // Debug logging for file conversion
  useEffect(() => {
    console.log(`📋 DownloadScreen: ${files.length} download files -> ${displayFiles.length} display files`);
    if (files.length > 0) {
      console.log(files[0])
      console.log('📋 Raw download files:', files.map(f => ({
        file_id: f.file_id,
        name: f.name,
        status: f.status,
        progress: f.progress
      })));
      console.log('📋 Converted display files:', displayFiles.map(f => ({
        id: f.id,
        name: f.name,
        status: f.status,
        progress: f.progress,
        source: f.source
      })));
    }
  }, [files, displayFiles]);

  if (!isMonitoring) {
    // Setup Mode
    return (
      <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
        <div className="w-full">
          {/* Compact Header */}
          <div className="flex items-center mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
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

          {/* Stats Preview */}
          {stats.queued + stats.downloading + stats.completed + stats.failed > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg">
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

          {/* Settings */}
          <div className="max-w-2xl space-y-6 mt-6">
            {/* Download Path */}
            <FolderSelector
              label="Download files to"
              value={downloadPath}
              onChange={handleFolderChange}
              type="destination"
              placeholder={isLoadingConfig ? "Loading..." : "Select download directory..."}
              required={true}
              disabled={isLoadingConfig}
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

            {/* Start Button */}
            <Button 
              color="green"
              className="w-full"
              onClick={handleStartMonitoring}
              disabled={!downloadPath || isStarting || isLoadingConfig}
            >
              {isLoadingConfig ? 'Loading...' : isStarting ? 'Starting...' : 'Start Monitoring'}
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

        {/* File List using consistent components */}
        {displayFiles.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
            <Text>No files in queue</Text>
            <Text className="text-sm">Files will appear here when detected</Text>
          </div>
        ) : (
          <FileList files={displayFiles} formatFileSize={formatFileSize} />
        )}
      </div>
    </div>
  );
};

export default DownloadScreen;