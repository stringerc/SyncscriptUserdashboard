// Preload script for Electron
// Exposes safe APIs to the renderer process

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected ipcRenderer methods
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      // whitelist channels
      let validChannels = ['cortana-command'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel, func) => {
      let validChannels = ['cortana-response'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    removeListener: (channel, func) => {
      let validChannels = ['cortana-response'];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, (event, ...args) => func(...args));
      }
    }
  },
  // Example of exposing a utility function
  getSystemInfo: () => {
    return {
      platform: process.platform,
      version: process.versions.node,
      electron: process.versions.electron
    };
  }
});