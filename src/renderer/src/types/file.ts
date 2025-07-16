export type FileStatus = 'uploading' | 'completed' | 'failed';

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

export interface FileListProps {
  readonly files: ReadonlyArray<AppFile>;
  readonly formatFileSize: (size: number) => string;
}

export interface FileTileProps {
  readonly file: AppFile;
  readonly formatFileSize: (size: number) => string;
} 