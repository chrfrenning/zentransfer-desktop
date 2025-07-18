export type FileStatus = 'uploading' | 'completed' | 'failed' | 'queued' | 'downloading';

export interface AppFile {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly path?: string;
  readonly source: string;
  status?: FileStatus;
  progress?: number; // 0-100
  error?: string;
  readonly lastModified: number;
  readonly lastModifiedDate?: Date;
  readonly webkitRelativePath?: string;
  readonly constructor?: { readonly name: string };
}

export interface DownloadFile {
  readonly file_id: string | number; // From server
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly created?: string | undefined; // From server
  readonly thumbnail_url?: string | undefined; // From server
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0-100
  downloadedBytes?: number | undefined;
  totalBytes?: number | undefined;
  error?: string | null | undefined;
  readonly addedAt: number;
  updatedAt: number;
  completedAt?: number | undefined;
  filePath?: string | undefined; // Local path after download
}

export interface FileListProps {
  readonly files: ReadonlyArray<AppFile>;
  readonly formatFileSize: (size: number) => string;
}

export interface FileTileProps {
  readonly file: AppFile;
  readonly formatFileSize: (size: number) => string;
} 