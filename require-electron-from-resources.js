console.log('=== Trying to require electron from resources ===');
const path = require('path');
const fs = require('fs');

const electronExe = process.execPath;
console.log('Electron executable:', electronExe);

let resourcesPath;
if (process.platform === 'darwin' && electronExe.endsWith('Electron.app/Contents/MacOS/Electron')) {
  resourcesPath = path.join(path.dirname(electronExe), '..', 'Resources');
} else {
  resourcesPath = path.join(path.dirname(electronExe), 'resources');
}
console.log('Resources path:', resourcesPath);

// Check for electron.asar
const asarPaths = [
  path.join(resourcesPath, 'electron.asar'),
  path.join(resourcesPath, 'default_app.asar')
];

let electron = null;

for (const asarPath of asarPaths) {
  console.log('Checking ASAR:', asarPath);
  if (fs.existsSync(asarPath)) {
    console.log('  FOUND ASAR');
    try {
      // Try to require the ASAR as a module
      electron = require(asarPath);
      console.log('  Required ASAR, typeof:', typeof electron);
      if (electron && typeof electron === 'object') {
        console.log('  Has app:', !!electron.app);
        console.log('  Has BrowserWindow:', !!electron.BrowserWindow);
        console.log('  Has ipcMain:', !!electron.ipcMain);
        break;
      }
    } catch (e) {
      console.log('  Failed to require ASAR:', e.message);
    }
  }
}

// If we didn't get electron from ASAR, try to look for a commonjs module in resources
if (!electron || !(typeof electron === 'object' && electron !== null)) {
  console.log('\\n=== Trying to find electron module in resources directory ===');
  const possiblePaths = [
    path.join(resourcesPath, 'electron'),
    path.join(resourcesPath, 'dist', 'electron.js'),
    path.join(resourcesPath, 'resources', 'electron.asar'), // sometimes nested
  ];

  for (const p of possiblePaths) {
    console.log('Checking path:', p);
    if (fs.existsSync(p)) {
      console.log('  FOUND FILE');
      try {
        electron = require(p);
        console.log('  Required, typeof:', typeof electron);
        if (electron && typeof electron === 'object') {
          console.log('  Has app:', !!electron.app);
          console.log('  Has BrowserWindow:', !!electron.BrowserWindow);
          console.log('  Has ipcMain:', !!electron.ipcMain);
          break;
        }
      } catch (e) {
        console.log('  Failed to require:', e.message);
      }
    }
  }
}

console.log('\\n=== RESULT ===');
if (electron && typeof electron === 'object' && electron !== null) {
  console.log('SUCCESS: Got electron object');
  console.log('  electron.app:', !!electron.app);
  console.log('  electron.BrowserWindow:', !!electron.BrowserWindow);
  console.log('  electron.ipcMain:', !!electron.ipcMain);
} else {
  console.log('FAILED: Could not get electron object');
  console.log('  electron:', electron);
}