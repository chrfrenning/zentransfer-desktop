import useImportStore from '../stores/ImportStore';
import type { ImportFile, ImportFileStatus, ImportProgressData } from '../types/import';

interface SimulatorStatus {
  readonly isRunning: boolean;
  readonly isDiscovering: boolean;
  readonly filesProcessed: number;
  readonly currentFile?: string | undefined;
}

interface SampleFileTemplate {
  readonly name: string;
  readonly type: string;
  readonly sizeRange: [number, number]; // [min, max] in bytes
}

class ImportSimulator {
  private discoveryIntervalId: NodeJS.Timeout | null = null;
  private processIntervalId: NodeJS.Timeout | null = null;
  private isDiscovering: boolean = false;
  private isProcessing: boolean = false;
  private fileCounter: number = 0;
  private discoveredFileCount: number = 0;

  // Sample file templates for simulation
  private readonly sampleFiles: SampleFileTemplate[] = [
    { name: 'IMG_{counter}.jpg', type: 'image/jpeg', sizeRange: [2000000, 8000000] },
    { name: 'DSC_{counter}.jpg', type: 'image/jpeg', sizeRange: [3000000, 12000000] },
    { name: 'Photo_{counter}.png', type: 'image/png', sizeRange: [1500000, 6000000] },
    { name: 'VID_{counter}.mp4', type: 'video/mp4', sizeRange: [10000000, 50000000] },
    { name: 'MOV_{counter}.mov', type: 'video/quicktime', sizeRange: [15000000, 60000000] },
    { name: 'Document_{counter}.pdf', type: 'application/pdf', sizeRange: [500000, 2000000] },
    { name: 'Scan_{counter}.tiff', type: 'image/tiff', sizeRange: [5000000, 20000000] },
    { name: 'RAW_{counter}.cr2', type: 'image/raw', sizeRange: [20000000, 40000000] }
  ];

  public startDiscovery(): void {
    if (this.isDiscovering) {
      console.warn('Import simulator: Discovery already in progress');
      return;
    }

    const store = useImportStore.getState();
    const { settings } = store;

    if (!settings.sourcePath) {
      store.setError('Source path not specified');
      return;
    }

    this.isDiscovering = true;
    this.discoveredFileCount = 0;
    console.log('🔍 Import simulator: Starting file discovery from:', settings.sourcePath);

    store.setFiles([]); // Clear existing files
    
    // Simulate discovery progress
    this.simulateDiscovery();
  }

  private simulateDiscovery(): void {
    const store = useImportStore.getState();
    const totalFilesToDiscover = Math.floor(Math.random() * 25) + 15; // 15-40 files
    let discoveredCount = 0;

    // Simulate gradual file discovery
    this.discoveryIntervalId = setInterval(() => {
      if (discoveredCount >= totalFilesToDiscover) {
        this.completeDiscovery();
        return;
      }

      // Discover 1-3 files per iteration
      const filesToDiscoverNow = Math.min(
        Math.floor(Math.random() * 3) + 1,
        totalFilesToDiscover - discoveredCount
      );

      const newFiles: Partial<ImportFile>[] = [];
      for (let i = 0; i < filesToDiscoverNow; i++) {
        newFiles.push(this.generateRandomFile(discoveredCount + i + 1));
      }

      store.addFiles(newFiles);
      discoveredCount += filesToDiscoverNow;

      // Update discovery progress
      const progress = Math.floor((discoveredCount / totalFilesToDiscover) * 100);
      store.updateProgress({ overallProgress: progress });

      console.log(`🔍 Import simulator: Discovered ${newFiles.length} files (${discoveredCount}/${totalFilesToDiscover})`);
    }, 500); // Discover files every 500ms
  }

  private completeDiscovery(): void {
    if (this.discoveryIntervalId) {
      clearInterval(this.discoveryIntervalId);
      this.discoveryIntervalId = null;
    }

    this.isDiscovering = false;
    const store = useImportStore.getState();
    
    // Mark all discovered files as queued and ready for processing
    const queuedFiles = store.files.map(file => ({
      ...file,
      status: 'queued' as ImportFileStatus
    }));
    
    store.setFiles(queuedFiles);
    store.updateProgress({ overallProgress: 100 });
    
    console.log(`🔍 Import simulator: Discovery completed. Found ${queuedFiles.length} files`);
  }

  public startProcessing(): void {
    if (this.isProcessing) {
      console.warn('Import simulator: Processing already in progress');
      return;
    }

    const store = useImportStore.getState();
    const queuedFiles = store.getQueuedFiles();

    if (queuedFiles.length === 0) {
      console.warn('Import simulator: No files to process');
      return;
    }

    this.isProcessing = true;
    this.fileCounter = 0;
    console.log('⚙️ Import simulator: Starting file processing');

    // Start processing files one by one
    this.processIntervalId = setInterval(() => {
      this.processNextFile();
    }, 2000); // Process one file every 2 seconds
  }

  private processNextFile(): void {
    const store = useImportStore.getState();
    const queuedFiles = store.getQueuedFiles();

    if (queuedFiles.length === 0) {
      this.completeProcessing();
      return;
    }

    const nextFile = queuedFiles[0];
    if (!nextFile) return;

    this.fileCounter++;

    // Start processing the file
    console.log(`⚙️ Import simulator: Processing file ${this.fileCounter}: ${nextFile.name}`);
    store.updateFileStatus(nextFile.id, 'processing', 0);
    
    // Update progress data
    const totalFiles = store.getTotalFiles();
    const completedFiles = store.getCompletedFiles().length + store.getFailedFiles().length;
    const overallProgress = totalFiles > 0 ? Math.floor((completedFiles / totalFiles) * 100) : 0;
    
    store.updateProgress({
      currentFile: nextFile,
      currentDestination: this.getCurrentDestination(store.settings),
      overallProgress,
      currentFileProgress: 0
    });

    // Simulate file processing progress
    void this.simulateFileProgress(nextFile.id);
  }

  private async simulateFileProgress(fileId: string): Promise<void> {
    const store = useImportStore.getState();
    const file = store.files.find(f => f.id === fileId);

    if (!file || file.status !== 'processing') {
      return;
    }

    // Simulate progress from 0 to 100% over 1.5 seconds
    const progressSteps: ReadonlyArray<number> = [15, 35, 55, 75, 90, 100];
    const stepDelay = 250; // milliseconds between progress updates

    for (const progress of progressSteps) {
      await new Promise<void>(resolve => setTimeout(resolve, stepDelay));

      // Check if file is still processing (might have been cancelled)
      const currentFile = useImportStore.getState().files.find(f => f.id === fileId);
      if (!currentFile || currentFile.status !== 'processing') {
        return;
      }

      store.updateFileProgress(fileId, progress);
      store.updateProgress({ currentFileProgress: progress });
      console.log(`📊 Import simulator: File ${file.name}: ${progress}%`);
    }

    // Determine final status - every 8th file fails, every 12th is skipped
    let finalStatus: ImportFileStatus;
    let error: string | null = null;

    if (this.fileCounter % 12 === 0) {
      finalStatus = 'skipped';
      error = 'File skipped (duplicate detected)';
    } else if (this.fileCounter % 8 === 0) {
      finalStatus = 'failed';
      error = 'Simulated processing failure';
    } else {
      finalStatus = 'completed';
    }

    if (finalStatus === 'failed') {
      console.log(`❌ Import simulator: Processing failed: ${file.name}`);
    } else if (finalStatus === 'skipped') {
      console.log(`⏭️ Import simulator: File skipped: ${file.name}`);
    } else {
      console.log(`✅ Import simulator: Processing completed: ${file.name}`);
    }

    store.updateFileStatus(fileId, finalStatus, 100, error);

    // Update overall progress
    const totalFiles = store.getTotalFiles();
    const processedFiles = store.getCompletedFiles().length + store.getFailedFiles().length + store.getSkippedFiles().length;
    const overallProgress = totalFiles > 0 ? Math.floor((processedFiles / totalFiles) * 100) : 0;
    
    store.updateProgress({
      overallProgress,
      currentFileProgress: 0
    });
  }

  private completeProcessing(): void {
    if (this.processIntervalId) {
      clearInterval(this.processIntervalId);
      this.processIntervalId = null;
    }

    this.isProcessing = false;
    const store = useImportStore.getState();
    
    store.updateProgress({
      currentFile: undefined,
      currentDestination: undefined,
      overallProgress: 100,
      currentFileProgress: 0
    });

    store.setMode('done');
    
    const stats = store.stats;
    console.log('🎉 Import simulator: Processing completed!');
    console.log(`📊 Import simulator: Stats - Completed: ${stats.completed}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
  }

  public stop(): void {
    console.log('⏹️ Import simulator: Stopping all operations');

    if (this.discoveryIntervalId) {
      clearInterval(this.discoveryIntervalId);
      this.discoveryIntervalId = null;
    }

    if (this.processIntervalId) {
      clearInterval(this.processIntervalId);
      this.processIntervalId = null;
    }

    this.isDiscovering = false;
    this.isProcessing = false;

    const store = useImportStore.getState();
    store.setMode('setup');
    store.updateProgress({
      currentFile: undefined,
      currentDestination: undefined,
      overallProgress: 0,
      currentFileProgress: 0
    });
  }

  private generateRandomFile(counter: number): Partial<ImportFile> {
    const template = this.sampleFiles[Math.floor(Math.random() * this.sampleFiles.length)];
    if (!template) {
      throw new Error('No sample file templates available');
    }

    const size = Math.floor(
      Math.random() * (template.sizeRange[1] - template.sizeRange[0]) + template.sizeRange[0]
    );

    const paddedCounter = String(counter).padStart(4, '0');
    const name = template.name.replace('{counter}', paddedCounter);
    const path = `/source/path/${name}`;

    return {
      id: `import_sim_${Date.now()}_${counter}`,
      name,
      size,
      type: template.type,
      path,
      relativePath: name,
      lastModified: Date.now() - Math.floor(Math.random() * 86400000), // Random time in last 24h
      source: 'local' as const,
      status: 'discovered' as ImportFileStatus,
      progress: 0,
      error: null,
      discoveredAt: Date.now(),
      updatedAt: Date.now(),
      destinations: []
    };
  }

  private getCurrentDestination(settings: any): string {
    const destinations = [];
    
    if (settings.destinationPath) {
      destinations.push('Local destination');
    }
    
    if (settings.backupEnabled && settings.backupPath) {
      destinations.push('Backup');
    }

    if (settings.enableCloudUpload) {
      if (settings.uploadToZenTransfer) destinations.push('ZenTransfer');
      if (settings.uploadToAwsS3) destinations.push('AWS S3');
      if (settings.uploadToAzure) destinations.push('Azure');
      if (settings.uploadToGcp) destinations.push('GCP');
      if (settings.uploadToMinio) destinations.push('MinIO');
    }

    return destinations.length > 0 ? destinations[0] : 'Processing';
  }

  public getStatus(): SimulatorStatus {
    const progressData = useImportStore.getState().progressData;
    return {
      isRunning: this.isDiscovering || this.isProcessing,
      isDiscovering: this.isDiscovering,
      filesProcessed: this.fileCounter,
      currentFile: progressData.currentFile?.name
    };
  }

  public reset(): void {
    this.stop();
    this.fileCounter = 0;
    this.discoveredFileCount = 0;
    
    const store = useImportStore.getState();
    store.resetImport();
    
    console.log('🔄 Import simulator: Reset completed');
  }

  // Utility method to add test files for development
  public addTestFiles(count: number = 10): void {
    const store = useImportStore.getState();
    const testFiles: Partial<ImportFile>[] = [];

    for (let i = 1; i <= count; i++) {
      testFiles.push(this.generateRandomFile(i));
    }

    store.addFiles(testFiles);
    console.log(`📁 Import simulator: Added ${count} test files`);
  }
}

// Create singleton instance
const importSimulator = new ImportSimulator();

// Export both the class and singleton for flexibility
export { ImportSimulator };
export default importSimulator; 