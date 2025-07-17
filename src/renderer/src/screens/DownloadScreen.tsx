import React, { useState, useEffect, useRef } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import { Button } from '../components/catalyst/button';
import { Text } from '../components/catalyst/text';
import { Heading } from '../components/catalyst/heading';

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  created: string;
  addedAt: number;
  completedAt?: number;
  error?: string;
  thumbnail_url?: string;
}

const DownloadScreen = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [downloadPath, setDownloadPath] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState('Never');
  const [files, setFiles] = useState<FileItem[]>([]);
  const simulatorRef = useRef<NodeJS.Timeout | null>(null);
  const fileCounterRef = useRef(1);

  // Sample file names and types for simulation
  const sampleFiles = [
    { name: 'IMG_001.jpg', type: 'image/jpeg', size: 2500000 },
    { name: 'DSC_002.jpg', type: 'image/jpeg', size: 3200000 },
    { name: 'Photo_003.png', type: 'image/png', size: 1800000 },
    { name: 'Video_001.mp4', type: 'video/mp4', size: 15000000 },
    { name: 'Document.pdf', type: 'application/pdf', size: 850000 },
    { name: 'Report.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 420000 },
    { name: 'Spreadsheet.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 320000 },
    { name: 'Presentation.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 1200000 },
  ];

  // Generate random file
  const generateRandomFile = (): FileItem => {
    const template = sampleFiles[Math.floor(Math.random() * sampleFiles.length)];
    if (!template) {
      throw new Error('No sample files available');
    }
    const id = `file_${fileCounterRef.current++}_${Date.now()}`;
    const now = new Date().toISOString();
    
    return {
      id,
      name: template.name.replace(/\d+/, String(fileCounterRef.current - 1).padStart(3, '0')),
      size: template.size + Math.floor(Math.random() * 1000000),
      type: template.type,
      status: 'queued',
      created: now,
      addedAt: Date.now(),
    };
  };

  // Start download simulation for a file
  const startDownload = (fileId: string) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, status: 'downloading', progress: 0, downloadedBytes: 0, totalBytes: file.size }
        : file
    ));

    // Simulate download progress
    const progressInterval = setInterval(() => {
      setFiles(prev => {
        const file = prev.find(f => f.id === fileId);
        if (!file || file.status !== 'downloading') {
          clearInterval(progressInterval);
          return prev;
        }

        const newProgress = Math.min(100, (file.progress || 0) + Math.random() * 15);
        const newDownloadedBytes = Math.floor((newProgress / 100) * file.size);

        if (newProgress >= 100) {
          clearInterval(progressInterval);
          // 90% chance of success, 10% chance of failure
          const success = Math.random() > 0.1;
          
                     return prev.map(f => {
             if (f.id === fileId) {
               const updatedFile: FileItem = {
                 ...f,
                 status: success ? 'completed' : 'failed',
                 progress: success ? 100 : (f.progress || 0),
                 downloadedBytes: success ? f.size : (f.downloadedBytes || 0),
                 completedAt: Date.now()
               };
               if (!success) {
                 updatedFile.error = 'Download failed - network error';
               }
               return updatedFile;
             }
             return f;
           });
        }

        return prev.map(f => 
          f.id === fileId 
            ? { ...f, progress: newProgress, downloadedBytes: newDownloadedBytes }
            : f
        );
      });
    }, 200 + Math.random() * 300); // Random interval for realism
  };

  // Start file simulator
  const startSimulator = () => {
    if (simulatorRef.current) return;

    simulatorRef.current = setInterval(() => {
      // Add 1-3 random files
      const numFiles = Math.floor(Math.random() * 3) + 1;
      const newFiles = Array.from({ length: numFiles }, generateRandomFile);
      
      setFiles(prev => [...prev, ...newFiles]);

      // Start downloading queued files (simulate processing queue)
      setTimeout(() => {
        setFiles(prev => {
          const queuedFiles = prev.filter(f => f.status === 'queued');
          if (queuedFiles.length > 0) {
            // Start downloading the oldest queued file
            const oldestQueued = queuedFiles.reduce((oldest, current) => 
              current.addedAt < oldest.addedAt ? current : oldest
            );
            startDownload(oldestQueued.id);
          }
          return prev;
        });
      }, 500);
    }, 3000);
  };

  // Stop file simulator
  const stopSimulator = () => {
    if (simulatorRef.current) {
      clearInterval(simulatorRef.current);
      simulatorRef.current = null;
    }
  };

  // Handle browse path
  const handleBrowsePath = () => {
    // Simulate directory selection
    const paths = [
      '/Users/john/Downloads/ZenTransfer',
      'C:\\Users\\Jane\\Downloads\\ZenTransfer',
      '/home/user/Downloads/ZenTransfer',
      'C:\\Downloads\\Photos',
      '/Users/photographer/Desktop/Incoming'
    ];
    const selectedPath = paths[Math.floor(Math.random() * paths.length)];
    if (selectedPath) {
      setDownloadPath(selectedPath);
    }
  };

  // Handle reset sync
  const handleResetSync = () => {
    if (confirm('Reset sync time? This will re-download all files from the beginning.')) {
      setLastSyncTime('Never');
      // Clear existing files
      setFiles([]);
    }
  };

  // Handle start monitoring
  const handleStartMonitoring = () => {
    if (!downloadPath) {
      alert('Please set a download directory first');
      return;
    }
    
    setIsMonitoring(true);
    setLastSyncTime(new Date().toLocaleString());
    startSimulator();
  };

  // Handle stop monitoring
  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    stopSimulator();
  };

  // Remove file from list
  const handleRemoveFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file && (file.status === 'completed' || file.status === 'failed')) {
      if (confirm(`Remove "${file.name}" from queue?`)) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSimulator();
    };
  }, []);

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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Download files to</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" 
                  placeholder="Select download directory..."
                  value={downloadPath}
                  readOnly
                />
                <Button outline onClick={handleBrowsePath}>
                  Browse
                </Button>
              </div>
            </div>

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
              disabled={!downloadPath}
            >
              Start Monitoring
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
              <Text className="text-sm text-green-600 leading-tight">Monitoring active</Text>
            </div>
          </div>
          <Button color="red" onClick={handleStopMonitoring}>
            Stop
          </Button>
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
                  key={file.id} 
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRemoveFile(file.id)}
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
                        <Text className="text-xs text-gray-500">{new Date(file.created).toLocaleDateString()}</Text>
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