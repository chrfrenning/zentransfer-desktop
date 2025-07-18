import React, { useEffect } from 'react';
import { useDownloadStore } from '../stores/DownloadStore';
import { getElectronAPI } from '../api/ZenTransferAPI';

/**
 * DownloadMonitor - Demo component to test download message handling
 * 
 * This component:
 * 1. Sets up listeners for download messages from the main process
 * 2. Updates the download store based on received messages
 * 3. Logs all activity to console for debugging
 * 4. Provides basic stats display
 */
const DownloadMonitor: React.FC = () => {
  const {
    files,
    stats,
    isMonitoring,
    addFiles,
    updateFileStatus,
    updateFileProgress,
    setMonitoring
  } = useDownloadStore();

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

  // Helper to simulate adding test files (for development/testing)
  const addTestFiles = () => {
    const testFiles = [
      {
        file_id: `test_${Date.now()}_1`,
        name: 'test-image-1.jpg',
        size: 2500000,
        type: 'image/jpeg',
        created: new Date().toISOString(),
        status: 'queued' as const,
        progress: 0
      },
      {
        file_id: `test_${Date.now()}_2`,
        name: 'test-video-1.mp4',
        size: 15000000,
        type: 'video/mp4',
        created: new Date().toISOString(),
        status: 'queued' as const,
        progress: 0
      }
    ];
    
    addFiles(testFiles);
    console.log('🧪 Added test files to download store:', testFiles);
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Download Monitor (Console Demo)</h3>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center p-2 bg-white rounded border">
          <div className="text-2xl font-bold text-blue-600">{stats.queued}</div>
          <div className="text-sm text-gray-600">Queued</div>
        </div>
        <div className="text-center p-2 bg-white rounded border">
          <div className="text-2xl font-bold text-yellow-600">{stats.downloading}</div>
          <div className="text-sm text-gray-600">Downloading</div>
        </div>
        <div className="text-center p-2 bg-white rounded border">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="text-center p-2 bg-white rounded border">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
      </div>
      
      {/* Status */}
      <div className="mb-4">
        <p className="text-sm">
          <span className="font-medium">Monitoring:</span> 
          <span className={`ml-2 px-2 py-1 rounded text-xs ${isMonitoring ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {isMonitoring ? 'Active' : 'Inactive'}
          </span>
        </p>
        <p className="text-sm mt-1">
          <span className="font-medium">Total Files:</span> {files.length}
        </p>
      </div>
      
      {/* Test Controls */}
      <div className="mb-4">
        <button 
          onClick={addTestFiles}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Add Test Files
        </button>
      </div>
      
      {/* Instructions */}
      <div className="text-xs text-gray-600 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <p className="font-medium mb-1">Console Demo Instructions:</p>
        <p>1. Open browser dev tools (F12) and check the Console tab</p>
        <p>2. Start download monitoring from the main download screen</p>
        <p>3. Watch console for download progress, completed, and error messages</p>
        <p>4. See stats update in real-time above</p>
      </div>
      
      {/* File List (abbreviated for demo) */}
      {files.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Recent Files ({files.length})</h4>
          <div className="max-h-32 overflow-y-auto">
            {files.slice(-5).map((file) => (
              <div key={file.file_id} className="text-xs p-1 border-b border-gray-200 flex justify-between">
                <span className="truncate">{file.name}</span>
                <span className={`px-1 rounded ${
                  file.status === 'completed' ? 'bg-green-100 text-green-800' :
                  file.status === 'downloading' ? 'bg-yellow-100 text-yellow-800' :
                  file.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {file.status} {file.progress > 0 && `${file.progress}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadMonitor; 