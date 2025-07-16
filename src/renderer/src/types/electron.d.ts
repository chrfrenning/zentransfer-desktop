import type { IRendererLogger } from './logger';
import type { ZenTransferAPI } from '../api/ZenTransferAPI';

declare global {
  interface Window {
    readonly electronAPI: ZenTransferAPI;
    readonly electronPreloadLoaded: boolean;
    logger: IRendererLogger;
    uploadSimulator?: unknown;
    uploadStore?: unknown;
  }
}

export {}; 