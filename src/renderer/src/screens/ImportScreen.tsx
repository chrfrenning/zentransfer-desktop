import React, { useEffect } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import ImportSetupForm from '../components/import/ImportSetupForm';
import ImportProgress from '../components/import/ImportProgress';
import ImportComplete from '../components/import/ImportComplete';
import useImportStore from '../stores/ImportStore';
import importSimulator from '../utils/ImportSimulator';

const ImportScreen = () => {
  // Import store state
  const {
    mode,
    settings,
    files,
    stats,
    progressData,
    isDiscovering,
    hasFiles,
    canStartImport,
    updateSettings,
    loadSettings,
    startDiscovery,
    startImport,
    cancelImport,
    resetImport
  } = useImportStore();

  // Load settings and start simulator on mount
  useEffect(() => {
    loadSettings();
    
    // Add to window for debugging
    (window as any).importSimulator = importSimulator;
    (window as any).importStore = useImportStore;
    
    console.log('🧪 Import simulator available. Use window.importSimulator for debugging');
    console.log('💡 Try: window.importSimulator.addTestFiles(15)');

    return () => {
      // Cleanup on unmount
      importSimulator.stop();
    };
  }, [loadSettings]);

  // Format file size utility
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle discovery start
  const handleStartDiscovery = async (): Promise<void> => {
    try {
      await startDiscovery();
      // Start the simulator discovery
      importSimulator.startDiscovery();
    } catch (error) {
      console.error('Failed to start discovery:', error);
    }
  };

  // Handle import start
  const handleStartImport = async (): Promise<void> => {
    try {
      await startImport();
      // Start the simulator processing
      importSimulator.startProcessing();
    } catch (error) {
      console.error('Failed to start import:', error);
    }
  };

  // Handle import cancellation
  const handleCancelImport = async (): Promise<void> => {
    try {
      await cancelImport();
      // Stop the simulator
      importSimulator.stop();
    } catch (error) {
      console.error('Failed to cancel import:', error);
    }
  };

  // Handle starting new import
  const handleStartNew = (): void => {
    resetImport();
    importSimulator.reset();
  };

  // Render based on current mode
  const renderContent = () => {
    switch (mode) {
      case 'setup':
        return (
          <ImportSetupForm
            settings={settings}
            onSettingsChange={updateSettings}
            onStartImport={handleStartImport}
            onStartDiscovery={handleStartDiscovery}
            canStartImport={canStartImport()}
            isDiscovering={isDiscovering}
            hasFiles={hasFiles()}
          />
        );

      case 'processing':
        return (
          <ImportProgress
            files={files}
            stats={stats}
            progressData={progressData}
            onCancel={handleCancelImport}
            formatFileSize={formatFileSize}
          />
        );

      case 'done':
        return (
          <ImportComplete
            stats={stats}
            onStartNew={handleStartNew}
            formatFileSize={formatFileSize}
          />
        );

      default:
        return (
          <ImportSetupForm
            settings={settings}
            onSettingsChange={updateSettings}
            onStartImport={handleStartImport}
            onStartDiscovery={handleStartDiscovery}
            canStartImport={canStartImport()}
            isDiscovering={isDiscovering}
            hasFiles={hasFiles()}
          />
        );
    }
  };

  return (
    <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
      <div className="w-full">
        <ScreenHeader mode="import" />
        {renderContent()}
      </div>
    </div>
  );
};

export default ImportScreen; 