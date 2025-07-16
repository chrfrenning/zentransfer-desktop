export interface LoaderScreenProps {
  readonly onVersionCheckComplete: (shouldProceed: boolean) => void;
}

export type ScreenMode = 'import' | 'upload' | 'download' | 'settings';

export interface ScreenHeaderProps {
  readonly mode?: ScreenMode;
}

export interface ModeConfig {
  readonly title: string;
  readonly description: string;
  readonly color: string;
  readonly icon: React.ReactNode;
} 