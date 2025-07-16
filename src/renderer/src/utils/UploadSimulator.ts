import useUploadStore from '../stores/UploadStore';
import type { UploadFile } from '../types/store';

interface SimulatorStatus {
  readonly isRunning: boolean;
  readonly filesProcessed: number;
  readonly nextFailureAt: number;
}

interface TestFile {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly path: string;
  readonly source: string;
}

class UploadSimulator {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private fileCounter: number = 0; // Track files processed for failure simulation

  public start(): void {
    if (this.isRunning) {
      console.warn('Upload simulator is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Upload simulator started');
    
    // Process files every 3 seconds
    this.intervalId = setInterval(() => {
      this.processNextFile();
    }, 3000);
  }

  public stop(): void {
    if (!this.isRunning) {
      console.warn('Upload simulator is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('⏹️ Upload simulator stopped');
  }

  private processNextFile(): void {
    const store = useUploadStore.getState();
    const queuedFiles = store.getQueuedFiles();
    
    if (queuedFiles.length === 0) {
      // No files to process, but keep running in case more are added
      return;
    }

    const nextFile = queuedFiles[0]; // Get first queued file
    if (!nextFile) return; // Type guard for array access safety
    
    this.fileCounter++;

    // Start uploading the file
    console.log(`📤 Starting upload simulation for: ${nextFile.name}`);
    store.updateFileStatus(nextFile.id, 'uploading', 0);

    // Simulate progress updates
    void this.simulateProgress(nextFile.id);
  }

  private async simulateProgress(fileId: string | number): Promise<void> {
    const store = useUploadStore.getState();
    const file = store.files.find(f => f.id === fileId);
    
    if (!file || file.status !== 'uploading') {
      return;
    }

    // Simulate progress from 0 to 100% over 2.5 seconds
    const progressSteps: ReadonlyArray<number> = [10, 25, 45, 65, 80, 95, 100];
    const stepDelay = 350; // milliseconds between progress updates

    for (const progress of progressSteps) {
      await new Promise<void>(resolve => setTimeout(resolve, stepDelay));
      
      // Check if file is still uploading (might have been cancelled)
      const currentFile = useUploadStore.getState().files.find(f => f.id === fileId);
      if (!currentFile || currentFile.status !== 'uploading') {
        return;
      }

      store.updateFileProgress(fileId, progress);
      console.log(`📊 File ${file.name}: ${progress}%`);
    }

    // Determine final status - every 10th file fails
    const shouldFail = this.fileCounter % 10 === 0;
    const finalStatus = shouldFail ? 'failed' : 'completed';
    const error = shouldFail ? 'Simulated upload failure' : null;

    if (shouldFail) {
      console.log(`❌ Upload failed (simulation): ${file.name}`);
    } else {
      console.log(`✅ Upload completed (simulation): ${file.name}`);
    }

    store.updateFileStatus(fileId, finalStatus, 100, error);
  }

  // Reset the counter for testing different failure patterns
  public resetCounter(): void {
    this.fileCounter = 0;
    console.log('🔄 Upload simulator counter reset');
  }

  // Get current status
  public getStatus(): SimulatorStatus {
    return {
      isRunning: this.isRunning,
      filesProcessed: this.fileCounter,
      nextFailureAt: 10 - (this.fileCounter % 10)
    };
  }

  // Utility method to add test files
  public addTestFiles(count: number = 5): ReadonlyArray<TestFile> {
    const store = useUploadStore.getState();
    const testFiles: TestFile[] = [];

    for (let i = 1; i <= count; i++) {
      testFiles.push({
        id: `test-file-${Date.now()}-${i}`,
        name: `Test File ${i}.jpg`,
        size: Math.floor(Math.random() * 10000000) + 1000000, // 1-10MB
        type: 'image/jpeg',
        path: `/fake/path/Test File ${i}.jpg`,
        source: 'simulator'
      });
    }

    store.addFiles(testFiles);
    console.log(`📁 Added ${count} test files to queue`);
    
    return testFiles;
  }
}

// Create singleton instance
const uploadSimulator = new UploadSimulator();

// Export both the class and singleton for flexibility
export { UploadSimulator };
export default uploadSimulator; 