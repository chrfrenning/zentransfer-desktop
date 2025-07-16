import React, { useState, useEffect, useRef } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import FileList from '../components/FileList';
import OperationProgress from '../components/OperationProgress';
import { CloudFacade } from '../utils/CloudFacade';
import useUploadStore from '../stores/UploadStore';
import uploadSimulator from '../utils/UploadSimulator';

const UploadScreen = () => {
  // Zustand store subscriptions
  const files = useUploadStore(state => state.files);
  const stats = useUploadStore(state => state.stats);
  const selectedService = useUploadStore(state => state.selectedService);
  const addFiles = useUploadStore(state => state.addFiles);
  const clearAllFiles = useUploadStore(state => state.clearFiles);
  const setSelectedService = useUploadStore(state => state.setSelectedService);
  const hasFiles = useUploadStore(state => state.hasFiles());

  // Local state for UI
  const [availableServices, setAvailableServices] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropOverlayRef = useRef(null);

  // Load available services on component mount
  useEffect(() => {
    loadAvailableServices();
  }, []);

  // Load saved service preference
  useEffect(() => {
    loadSavedService();
  }, []);

  const loadAvailableServices = async () => {
    try {
      setIsLoading(true);
      const services = await CloudFacade.getEnabledServicesWithDisplayInfo();
      setAvailableServices(services);
      
      // Set default service if current selection is not available
      if (services.length > 0) {
        const currentServiceAvailable = services.some(s => s.type === selectedService);
        if (!currentServiceAvailable) {
          setSelectedService(services[0].type);
        }
      } else {
        setSelectedService(null);
      }
    } catch (error) {
      console.error('Failed to load available services:', error);
      setAvailableServices([]);
      setSelectedService(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedService = async () => {
    try {
      const savedService = await window.electronAPI.config.get('uploadSettings.lastSelectedService');
      if (savedService) {
        setSelectedService(savedService);
        console.log('Loaded saved upload service:', savedService);
      }
    } catch (error) {
      console.error('Failed to load saved upload service:', error);
    }
  };

  const saveSelectedService = async (serviceType) => {
    try {
      await window.electronAPI.config.set('uploadSettings.lastSelectedService', serviceType);
      console.log('Saved upload service preference:', serviceType);
    } catch (error) {
      console.error('Failed to save upload service preference:', error);
    }
  };

  const handleServiceChange = (e) => {
    const newService = e.target.value;
    setSelectedService(newService);
    saveSelectedService(newService);
    console.log('Selected service changed to:', newService);
  };

  const openFileDialog = async () => {
    console.log('=== OPENING NATIVE FILE DIALOG ===');
    
    // Check if any services are available
    if (availableServices.length === 0) {
      console.warn('No upload services available. Please log in or configure services in Settings.');
      return;
    }
    
    if (window.electronAPI) {
      try {
        // Use native Electron file dialog
        const result = await window.electronAPI.dialog.showFileDialog({
          properties: ['openFile', 'multiSelections'],
          title: 'Select files to upload',
          filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'raw', 'cr2', 'nef', 'arw', 'dng'] },
            { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v'] },
            { name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'] },
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        
        if (result && result.length > 0) {
          console.log('Files selected via native dialog:', result);
          
          // Add files to store and log them
          const newFiles = result.map(filePath => ({
            id: Date.now() + Math.random(),
            path: filePath,
            name: filePath.split(/[\\/]/).pop(),
            source: 'dialog'
          }));
          
          addFiles(newFiles);
          console.log('Added files from dialog:', newFiles);
        } else {
          console.log('No files selected or dialog cancelled');
        }
        
      } catch (error) {
        console.error('Native file dialog failed:', error);
      }
    } else {
      console.warn('Not in Electron environment, electronAPI not available');
    }
    
    console.log('=== END NATIVE FILE DIALOG ===');
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    console.log('=== DRAG ENTER EVENT ===');
    console.log('Event target:', e.target);
    console.log('DataTransfer types:', e.dataTransfer.types);
    
    if (!isDragOver) {
      console.log('Showing drop overlay');
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    console.log('=== DRAG LEAVE EVENT ===');
    console.log('Event target:', e.target);
    console.log('Related target:', e.relatedTarget);
    
    // Only hide if we're leaving the document entirely
    if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
      console.log('Hiding drop overlay (leaving document)');
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    console.log('=== DROP EVENT ===');
    console.log('Event target:', e.target);
    
    setIsDragOver(false);
    
    if (e.dataTransfer.files.length > 0) {
      console.log('=== ANALYZING DROPPED FILES ===');
      console.log('Number of files:', e.dataTransfer.files.length);
      console.log('DataTransfer types:', e.dataTransfer.types);
      
      // Log detailed information about each file
      const droppedFiles = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const hasPath = file.path && typeof file.path === 'string';
        
        const fileInfo = {
          id: Date.now() + Math.random() + i,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          lastModifiedDate: new Date(file.lastModified),
          webkitRelativePath: file.webkitRelativePath || '(none)',
          constructor: file.constructor.name,
          path: file.path || '(no path property)',
          hasPath: hasPath,
          source: 'drop'
        };
        
        droppedFiles.push(fileInfo);
        
        console.log(`File ${i + 1}:`, fileInfo);
        
        if (hasPath) {
          console.log(`  🎉 File ${i + 1} OPTIMIZATION: Has path property - will use direct file access!`);
          console.log(`  📁 Direct path: ${file.path}`);
        } else {
          console.log(`  ⚠️ File ${i + 1} FALLBACK: No path property - will need buffer + temporary file`);
          console.log(`  📦 Will read ${file.size} bytes into memory buffer`);
        }
      }
      
      // Add files to store
      addFiles(droppedFiles);
      console.log('Added files from drop:', droppedFiles);
    } else {
      console.log('No files in drop event');
    }
  };

  // Setup global drag and drop listeners
  useEffect(() => {
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [isDragOver]);

  // Start upload simulator for testing
  useEffect(() => {
    uploadSimulator.start();
    
    // Add to window for debugging
    window.uploadSimulator = uploadSimulator;
    window.uploadStore = useUploadStore;
    
    console.log('🧪 Upload simulator started. Use window.uploadSimulator for debugging');
    console.log('💡 Try: window.uploadSimulator.addTestFiles(10)');

    return () => {
      uploadSimulator.stop();
    };
  }, []);

  const clearFiles = () => {
    clearAllFiles();
    console.log('Cleared file list');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
        <div className="w-full">
          <ScreenHeader mode="upload" />
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Loading upload services...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - shown when no files
  if (!hasFiles) {
    return (
      <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
        <div className="w-full">
          <ScreenHeader mode="upload" />
          
          {/* Drop Overlay */}
          {isDragOver && (
            <div className="fixed inset-0 bg-blue-500 bg-opacity-90 z-50 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="mb-6">
                  <div className="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <svg className="w-16 h-16 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                  </div>
                </div>
                <h2 className="text-4xl font-bold mb-4">Drop files to upload</h2>
                <p className="text-xl opacity-90">Release to add files to the queue</p>
              </div>
            </div>
          )}

          {/* Empty State Content */}
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center transition-all duration-300 rounded-lg">
            
            {/* Upload Area */}
            <div 
              className={`cursor-pointer transition-all duration-300 hover:bg-gray-50 rounded-lg p-8 ${
                availableServices.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={availableServices.length > 0 ? openFileDialog : undefined}
            >
              <div className="upload-icon-container mb-6 flex justify-center">
                <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Drop files here to upload</h2>
              <p className="text-gray-600 mb-4">Or click to browse files</p>
            </div>
            
            {/* Service Selection */}
            <div className="w-full max-w-md">
              {availableServices.length === 0 ? (
                <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-gray-900 font-medium mb-2">No Upload Services Available</div>
                  <div className="text-sm text-gray-800 mb-3">
                    Please configure cloud storage services in Settings.
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload to:</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={selectedService}
                    onChange={handleServiceChange}
                  >
                    {availableServices.map(service => (
                      <option key={service.type} value={service.type}>
                        {service.icon} {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Queue state - shown when files are present
  return (
    <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
      <div className="w-full">
        
        {/* Drop Overlay */}
        {isDragOver && (
          <div className="fixed inset-0 bg-blue-500 bg-opacity-90 z-50 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="mb-6">
                <div className="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <svg className="w-16 h-16 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                </div>
              </div>
              <h2 className="text-4xl font-bold mb-4">Drop files to upload</h2>
              <p className="text-xl opacity-90">Release to add files to the queue</p>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        <OperationProgress 
          queued={stats.queued}
          uploading={stats.uploading}
          completed={stats.completed}
          failed={stats.failed}
          operationType="upload"
          onViewLog={() => console.log('View upload log - to be implemented')}
        />

        {/* Files List */}
        <FileList files={files} formatFileSize={formatFileSize} />

        {/* Upload More Files and Clear Actions */}
        <div className="text-center mt-6 space-y-3">
          <button 
            className={`inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              availableServices.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={availableServices.length > 0 ? openFileDialog : undefined}
            disabled={availableServices.length === 0}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Upload more files...
          </button>
          
          {/* Debug Controls */}
          <div className="flex justify-center space-x-4 text-sm">
            <button 
              className="text-purple-600 hover:text-purple-800 hover:underline transition-all duration-200 focus:outline-none focus:underline"
              onClick={() => uploadSimulator.addTestFiles(5)}
            >
              + Add 5 test files
            </button>
            <button 
              className="text-gray-600 hover:text-gray-800 hover:underline transition-all duration-200 focus:outline-none focus:underline"
              onClick={clearFiles}
            >
              Clear file list
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadScreen; 