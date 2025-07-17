import { create } from 'zustand';
import { getElectronAPI } from '../api/ZenTransferAPI';
import type { 
  ImportStore, 
  ImportFile, 
  ImportFileStatus, 
  ImportSettings, 
  ImportStats, 
  ImportMode, 
  ImportProgressData 
} from '../types/import';

// Initial stats
const initialStats: ImportStats = {
  discovered: 0,
  queued: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  totalSize: 0,
  processedSize: 0
};

// Initial progress data
const initialProgressData: ImportProgressData = {
  overallProgress: 0,
  currentFileProgress: 0
};

// Default settings
const defaultSettings: Partial<ImportSettings> = {
  includeSubdirectories: true,
  organizeIntoFolders: false,
  folderOrganizationType: 'date',
  dateFormat: '2025/05/26',
  backupEnabled: false,
  enableCloudUpload: false,
  uploadToZenTransfer: false,
  uploadToAwsS3: false,
  uploadToAzure: false,
  uploadToGcp: false,
  uploadToMinio: false,
  skipDuplicates: false,
  skipExisting: false,
  createPreviews: false,
  extractMetadata: false
};

const useImportStore = create<ImportStore>((set, get) => ({
  // Initial state
  files: [],
  stats: initialStats,
  settings: defaultSettings,
  mode: 'setup',
  isLoading: false,
  progressData: initialProgressData,
  lastError: null,
  isDiscovering: false,
  discoveryProgress: 0,

  // File management actions
  setFiles: (files: ImportFile[]): void => {
    set((state) => {
      const newStats = calculateStats(files);
      console.log(`Import store: Set ${files.length} files`);
      return { 
        files, 
        stats: newStats 
      };
    });
  },

  addFiles: (newFiles: Partial<ImportFile>[]): void => {
    const filesToAdd: ImportFile[] = newFiles.map(file => ({
      id: file.id ?? `import_${Date.now()}_${Math.random()}`,
      name: file.name ?? 'Unknown',
      size: file.size ?? 0,
      type: file.type ?? 'application/octet-stream',
      path: file.path ?? '',
      relativePath: file.relativePath ?? '',
      lastModified: file.lastModified ?? Date.now(),
      source: file.source ?? 'local',
      status: 'discovered' as ImportFileStatus,
      progress: 0,
      error: null,
      discoveredAt: Date.now(),
      updatedAt: Date.now(),
      destinations: [],
      ...file
    }));

    set((state) => {
      const updatedFiles = [...state.files, ...filesToAdd];
      const newStats = calculateStats(updatedFiles);
      console.log(`Import store: Added ${filesToAdd.length} files`);
      return { 
        files: updatedFiles, 
        stats: newStats 
      };
    });
  },

  updateFileStatus: (
    fileId: string, 
    status: ImportFileStatus, 
    progress: number = 0, 
    error: string | null = null
  ): void => {
    set((state) => {
      const oldFile = state.files.find(f => f.id === fileId);
      if (!oldFile) return state;

      const updatedFiles = state.files.map(file =>
        file.id === fileId 
          ? { 
              ...file, 
              status, 
              progress,
              error,
              updatedAt: Date.now(),
              completedAt: (status === 'completed' || status === 'failed') ? Date.now() : undefined
            } 
          : file
      );

      const newStats = calculateStats(updatedFiles);
      console.log(`Import store: File ${fileId} status changed: ${oldFile.status} -> ${status}`);
      
      return { 
        files: updatedFiles, 
        stats: newStats 
      };
    });
  },

  updateFileProgress: (fileId: string, progress: number): void => {
    set((state) => ({
      files: state.files.map(file =>
        file.id === fileId 
          ? { ...file, progress, updatedAt: Date.now() }
          : file
      )
    }));
  },

  clearFiles: (): void => {
    set({ 
      files: [], 
      stats: initialStats,
      progressData: initialProgressData 
    });
    console.log('Import store: Cleared all files');
  },

  // Settings management
  updateSettings: (newSettings: Partial<ImportSettings>): void => {
    set((state) => {
      const updatedSettings = { ...state.settings, ...newSettings };
      console.log('Import store: Updated settings', newSettings);
      return { settings: updatedSettings };
    });
    
    // Save settings immediately
    get().saveSettings();
  },

  loadSettings: async (): Promise<void> => {
    try {
      const api = getElectronAPI();
      const importSettings = await api.config.get('importSettings');
      
      if (importSettings && typeof importSettings === 'object') {
        const settings = importSettings as Record<string, unknown>;
        const loadedSettings: Partial<ImportSettings> = {
          sourcePath: settings['importPath'] as string,
          destinationPath: settings['importDestinationPath'] as string,
          backupPath: settings['importBackupPath'] as string,
          includeSubdirectories: settings['includeSubdirectories'] !== false,
          organizeIntoFolders: settings['organizeIntoFolders'] !== false,
          folderOrganizationType: (settings['folderOrganizationType'] as 'date' | 'custom') || 'date',
          customFolderName: settings['customFolderName'] as string,
          dateFormat: (settings['dateFormat'] as string) || '2025/05/26',
          backupEnabled: settings['importBackupEnabled'] as boolean,
          enableCloudUpload: settings['enableCloudUpload'] as boolean,
          uploadToZenTransfer: settings['uploadEnabled'] as boolean,
          uploadToAwsS3: settings['uploadToAwsS3'] as boolean,
          uploadToAzure: settings['uploadToAzure'] as boolean,
          uploadToGcp: settings['uploadToGcp'] as boolean,
          uploadToMinio: settings['uploadToMinio'] as boolean,
          skipDuplicates: false,
          skipExisting: false,
          createPreviews: false,
          extractMetadata: false
        };

        // Load global preferences
        const skipDuplicates = await api.config.get('preferences.skipDuplicates');
        const skipExisting = await api.config.get('preferences.skipExisting');
        const createPreviews = await api.config.get('preferences.createPreviews');
        const extractMetadata = await api.config.get('preferences.extractMetaData');

        // Create final settings object with preferences
        const finalSettings = {
          ...loadedSettings,
          skipDuplicates: skipDuplicates as boolean,
          skipExisting: skipExisting as boolean,
          createPreviews: createPreviews as boolean,
          extractMetadata: extractMetadata as boolean
        };

        set({ settings: { ...defaultSettings, ...finalSettings } });
        console.log('Import store: Loaded settings from configuration');
      }
    } catch (error) {
      console.error('Import store: Failed to load settings:', error);
      set({ settings: defaultSettings });
    }
  },

  saveSettings: async (): Promise<void> => {
    try {
      const api = getElectronAPI();
      const { settings } = get();
      
      // Save to importSettings section
      if (settings.sourcePath) {
        await api.config.set('importSettings.importPath', settings.sourcePath);
      }
      if (settings.destinationPath) {
        await api.config.set('importSettings.importDestinationPath', settings.destinationPath);
      }
      if (settings.backupPath) {
        await api.config.set('importSettings.importBackupPath', settings.backupPath);
      }
      
      await api.config.set('importSettings.includeSubdirectories', settings.includeSubdirectories);
      await api.config.set('importSettings.organizeIntoFolders', settings.organizeIntoFolders);
      await api.config.set('importSettings.folderOrganizationType', settings.folderOrganizationType);
      await api.config.set('importSettings.customFolderName', settings.customFolderName);
      await api.config.set('importSettings.dateFormat', settings.dateFormat);
      await api.config.set('importSettings.importBackupEnabled', settings.backupEnabled);
      await api.config.set('importSettings.enableCloudUpload', settings.enableCloudUpload);
      await api.config.set('importSettings.uploadEnabled', settings.uploadToZenTransfer);
      await api.config.set('importSettings.uploadToAwsS3', settings.uploadToAwsS3);
      await api.config.set('importSettings.uploadToAzure', settings.uploadToAzure);
      await api.config.set('importSettings.uploadToGcp', settings.uploadToGcp);
      await api.config.set('importSettings.uploadToMinio', settings.uploadToMinio);

      console.log('Import store: Saved settings to configuration');
    } catch (error) {
      console.error('Import store: Failed to save settings:', error);
    }
  },

  // Import operations
  startDiscovery: async (): Promise<void> => {
    const { settings } = get();
    if (!settings.sourcePath) {
      set({ lastError: 'Source path not specified' });
      return;
    }

    set({ 
      isDiscovering: true, 
      discoveryProgress: 0, 
      lastError: null,
      files: [],
      stats: initialStats
    });

    try {
      // Simulate file discovery (replace with actual implementation)
      console.log('Import store: Starting file discovery from:', settings.sourcePath);
      
      // This would be replaced with actual file discovery logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      set({ 
        isDiscovering: false, 
        discoveryProgress: 100,
        mode: 'setup' // Stay in setup mode after discovery
      });
      
      console.log('Import store: File discovery completed');
    } catch (error) {
      console.error('Import store: File discovery failed:', error);
      set({ 
        isDiscovering: false, 
        lastError: error instanceof Error ? error.message : 'Discovery failed'
      });
    }
  },

  startImport: async (): Promise<void> => {
    const { canStartImport } = get();
    if (!canStartImport()) {
      set({ lastError: 'Import cannot be started - check configuration' });
      return;
    }

    set({ 
      mode: 'processing', 
      lastError: null,
      progressData: initialProgressData
    });

    console.log('Import store: Starting import process');
  },

  cancelImport: async (): Promise<void> => {
    console.log('Import store: Cancelling import');
    set({ 
      mode: 'setup',
      progressData: initialProgressData
    });
  },

  resetImport: (): void => {
    set({
      files: [],
      stats: initialStats,
      mode: 'setup',
      progressData: initialProgressData,
      lastError: null,
      isDiscovering: false,
      discoveryProgress: 0
    });
    console.log('Import store: Reset import state');
  },

  // Mode management
  setMode: (mode: ImportMode): void => {
    set({ mode });
    console.log(`Import store: Mode changed to ${mode}`);
  },

  // Progress updates
  updateProgress: (progressData: Partial<ImportProgressData>): void => {
    set((state) => ({
      progressData: { ...state.progressData, ...progressData }
    }));
  },

  // Error handling
  setError: (error: string | null): void => {
    set({ lastError: error });
    if (error) {
      console.error('Import store: Error set:', error);
    }
  },

  clearError: (): void => {
    set({ lastError: null });
  },

  // Selectors
  getDiscoveredFiles: (): ImportFile[] => get().files.filter(f => f.status === 'discovered'),
  getQueuedFiles: (): ImportFile[] => get().files.filter(f => f.status === 'queued'),
  getProcessingFiles: (): ImportFile[] => get().files.filter(f => f.status === 'processing'),
  getCompletedFiles: (): ImportFile[] => get().files.filter(f => f.status === 'completed'),
  getFailedFiles: (): ImportFile[] => get().files.filter(f => f.status === 'failed'),
  getSkippedFiles: (): ImportFile[] => get().files.filter(f => f.status === 'skipped'),
  getTotalFiles: (): number => get().files.length,
  hasFiles: (): boolean => get().files.length > 0,
  isCompleted: (): boolean => {
    const stats = get().stats;
    return stats.queued === 0 && stats.processing === 0 && (stats.completed > 0 || stats.failed > 0);
  },
  canStartImport: (): boolean => {
    const { settings, files } = get();
    return !!(
      settings.sourcePath && 
      settings.destinationPath && 
      (!settings.backupEnabled || settings.backupPath) &&
      files.length > 0
    );
  }
}));

// Helper function to calculate stats from files array
function calculateStats(files: ImportFile[]): ImportStats {
  const stats = files.reduce((acc, file) => {
    acc[file.status] = (acc[file.status] || 0) + 1;
    acc.totalSize += file.size;
    if (file.status === 'completed') {
      acc.processedSize += file.size;
    }
    return acc;
  }, {
    discovered: 0,
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    totalSize: 0,
    processedSize: 0
  });

  return stats;
}

export default useImportStore; 