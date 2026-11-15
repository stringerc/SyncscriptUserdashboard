// Scan the global object for anything that looks like electron

console.log('=== Scanning global object ===');

let count = 0;
for (let key in global) {
  try {
    const value = global[key];
    if (value && typeof value === 'object' && value !== null) {
      // Check for electron-like properties
      const hasApp = !!value.app;
      const hasBrowserWindow = !!value.BrowserWindow;
      const hasIpcMain = !!value.ipcMain;
      const hasWebContents = !!value.webContents;
      const hasSession = !!value.session;
      const hasProtocol = !!value.protocol;

      if (hasApp || hasBrowserWindow || hasIpcMain || hasWebContents || hasSession || hasProtocol) {
        console.log(`Global.${key}:`);
        console.log('  typeof:', typeof value);
        console.log('  Has app:', hasApp);
        console.log('  Has BrowserWindow:', hasBrowserWindow);
        console.log('  Has ipcMain:', hasIpcMain);
        console.log('  Has webContents:', hasWebContents);
        console.log('  Has session:', hasSession);
        console.log('  Has protocol:', hasProtocol);
        // Log a few keys of the object
        const keys = Object.keys(value);
        console.log('  First 10 keys:', keys.slice(0, 10));
        count++;
      }
    }
  } catch (e) {
    // Ignore errors
  }
}

console.log(`Found ${count} global objects with electron-like properties`);

// Also, let's check if there is a way to get the electron module from the module constructor
console.log('\n=== Checking module.constructor ===');
const mod = require('module');
console.log('module.constructor:', mod.constructor);
if (mod.constructor && mod.constructor._cache) {
  console.log('module.constructor._cache size:', Object.keys(mod.constructor._cache).length);
  // Look for electron in the constructor's cache
  for (let key in mod.constructor._cache) {
    if (key.includes('electron')) {
      console.log(`Found electron in constructor cache: ${key}`);
      const entry = mod.constructor._cache[key];
      if (entry && entry.exports) {
        const exports = entry.exports;
        if (exports && typeof exports === 'object' && exports !== null) {
          console.log('  Has app:', !!exports.app);
          console.log('  Has BrowserWindow:', !!exports.BrowserWindow);
          console.log('  Has ipcMain:', !!exports.ipcMain);
        }
      }
    }
  }
}