console.log('Starting...');
console.log('process.versions.electron:', process.versions.electron);

// Just check global and cache quickly
const mod = require('module');
console.log('Cache entries:', Object.keys(mod._cache).length);

let found = false;
for (let key in global) {
  if (key.toLowerCase().includes('electron')) {
    try {
      const value = global[key];
      if (value && typeof value === 'object' && value !== null) {
        console.log(`Found global.${key}:`, typeof value);
        if (value.app || value.BrowserWindow || value.ipcMain) {
          console.log('>>> LIKELY ELECTRON MODULE');
          found = true;
        }
      }
    } catch (e) {}
  }
}

if (!found) {
  console.log('No electron-like globals found');
}

// Check a few cache entries
let count = 0;
for (let key in mod._cache) {
  if (count < 5) {
    console.log('Cache key:', key.substring(0, 50));
    count++;
  } else {
    break;
  }
}
console.log('Done');