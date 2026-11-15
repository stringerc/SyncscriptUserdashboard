// Type declarations for the Electron preload bridge
// These are only available when running inside the Electron shell

interface ElectronIpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  send(channel: string, data: unknown): void;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
}

interface Window {
  electron?: {
    ipcRenderer: ElectronIpcRenderer;
    getSystemInfo?: () => { platform: string; version: string; electron: string };
  };
}
