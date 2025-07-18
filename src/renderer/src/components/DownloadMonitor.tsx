import React, { useEffect } from 'react';
import { useDownloadStore } from '../stores/DownloadStore';
import { getElectronAPI } from '../api/ZenTransferAPI';

/**
 * DownloadMonitor - Persistent background component for download management
 * 
 * This component runs continuously and:
 * 1. Sets up listeners for download messages from the main process
 * 2. Updates the download store based on received messages
 * 3. Logs all activity to console for debugging
 * 4. Handles download events even when UI is not actively monitoring
 * 
 * The main process can initiate downloads independently, so this must
 * always be active to maintain accurate state.
 */
const DownloadMonitor: React.FC = () => {
  const {
    files,
    stats,
    isMonitoring,
    addFiles,
    updateFile,
    addOrUpdateFile,
    updateFileStatus,
    updateFileProgress,
    setMonitoring,
    setLastSyncTime
  } = useDownloadStore();

  // Helper function to dump store state for debugging
  const dumpStoreState = (context: string) => {
    console.log(`🗂️ [${context}] Download Store State:`, {
      fileCount: files.length,
      stats,
      isMonitoring,
      files: files.map(f => ({
        file_id: f.file_id,
        name: f.name,
        status: f.status,
        progress: f.progress,
        size: f.size,
        addedAt: f.addedAt,
        updatedAt: f.updatedAt
      }))
    });
  };

  useEffect(() => {
    const electronAPI = getElectronAPI();
    
    console.log('🔄 Setting up persistent download message listeners...');
    
    // Set up progress listener
    const progressCleanup = electronAPI.download.onProgress((progressData) => {
      console.log('📈 Download Progress:', progressData);
      
      const { fileRecord, downloadedBytes, totalBytes } = progressData;
      console.log('📋 FileRecord structure:', fileRecord);
      
      // Calculate progress percentage
      const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
      
      // Ensure file exists in store (main process might have added it)
      // Map all available properties from fileRecord
      const fileRecordAny = fileRecord as any;
      const fileData = {
        file_id: fileRecord.file_id,
        name: fileRecord.name,
        size: fileRecord.size || fileRecordAny.file_size || 0,
        type: fileRecord.type || fileRecordAny.mime_type || 'application/octet-stream',
        created: fileRecordAny.created,
        thumbnail_url: fileRecordAny.thumbnail_url,
        status: 'downloading' as const,
        progress,
        downloadedBytes,
        totalBytes
      };
      
      console.log('📝 Storing file data:', fileData);
      addOrUpdateFile(fileRecord.file_id, fileData);
      
      console.log(`📈 Updated progress for ${fileRecord.name}: ${progress}% (${downloadedBytes}/${totalBytes} bytes)`);
      dumpStoreState('PROGRESS UPDATE');
    });
    
    // Set up completed listener
    const completedCleanup = electronAPI.download.onCompleted((completedData) => {
      console.log('✅ Download Completed:', completedData);
      
      const { fileRecord, filePath } = completedData;
      console.log('📋 Completed FileRecord structure:', fileRecord);
      
      // Update store with completion - preserve all file data
      const fileRecordAny = fileRecord as any;
      addOrUpdateFile(fileRecord.file_id, {
        file_id: fileRecord.file_id,
        name: fileRecord.name,
        size: fileRecord.size || fileRecordAny.file_size || 0,
        type: fileRecord.type || fileRecordAny.mime_type || 'application/octet-stream',
        created: fileRecordAny.created,
        thumbnail_url: fileRecordAny.thumbnail_url,
        status: 'completed',
        progress: 100,
        filePath,
        completedAt: Date.now()
      });
      
      console.log(`✅ Completed download: ${fileRecord.name} -> ${filePath}`);
      dumpStoreState('DOWNLOAD COMPLETED');
    });
    
    // Set up error listener
    const errorCleanup = electronAPI.download.onError((errorData) => {
      console.log('❌ Download Error:', errorData);
      
      const { fileRecord, errorMessage } = errorData;
      console.log('📋 Error FileRecord structure:', fileRecord);
      
      // Update store with error - preserve all file data
      const fileRecordAny = fileRecord as any;
      addOrUpdateFile(fileRecord.file_id, {
        file_id: fileRecord.file_id,
        name: fileRecord.name,
        size: fileRecord.size || fileRecordAny.file_size || 0,
        type: fileRecord.type || fileRecordAny.mime_type || 'application/octet-stream',
        created: fileRecordAny.created,
        thumbnail_url: fileRecordAny.thumbnail_url,
        status: 'failed',
        error: errorMessage,
        completedAt: Date.now()
      });
      
      console.log(`❌ Failed download: ${fileRecord.name} - Error: ${errorMessage}`);
      dumpStoreState('DOWNLOAD FAILED');
    });
    
    // Set up monitoring state listeners
    const monitoringStartedCleanup = electronAPI.download.onMonitoringStarted(() => {
      console.log('🚀 Download monitoring started');
      setMonitoring(true);
      setLastSyncTime(new Date().toLocaleString());
      dumpStoreState('MONITORING STARTED');
    });
    
    const monitoringStoppedCleanup = electronAPI.download.onMonitoringStopped(() => {
      console.log('🛑 Download monitoring stopped');
      setMonitoring(false);
    });
    
    // Set up additional download events (for other event types)
    const updateCleanup = electronAPI.download.onUpdate((updateData) => {
      console.log('🔄 Download Update:', updateData);
    });
    
    console.log('✅ Persistent download message listeners configured');
    
    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up persistent download message listeners...');
      progressCleanup();
      completedCleanup();
      errorCleanup();
      monitoringStartedCleanup();
      monitoringStoppedCleanup();
      updateCleanup();
    };
  }, [files, stats, isMonitoring, addFiles, updateFile, addOrUpdateFile, updateFileStatus, updateFileProgress, setMonitoring, setLastSyncTime]);

  // This component doesn't render anything - it's purely for background monitoring
  return null;
};

export default DownloadMonitor; 