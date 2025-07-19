import 'electron';

declare module 'electron' {
  interface App {
    configurationManager: {
      get(key: string): any; // adjust `any` to a specific return type
      set?(key: string, value: any): void; // optional example
      exportConfig(): any;
      [key: string]: any;
    };
    downloadWorkerPool: {
      [key: string]: any;
    };
    uploadWorkerPool: {
      [key: string]: any;
    };
    uploadSession: {
      [key: string]: any;
    };
    tokenManager: {
      [key: string]: any;
    };
  }
}