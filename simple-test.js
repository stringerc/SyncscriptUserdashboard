console.log('=== SIMPLE TEST ===');
console.log('process.versions:', JSON.stringify(process.versions, null, 2));
console.log('process.type:', process.type);
console.log('__dirname:', __dirname);

// Test if we can require anything
try {
  const path = require('path');
  console.log('path require works:', typeof path);
} catch (e) {
  console.log('path require failed:', e.message);
}

// Try to require electron with more diagnostics
console.log('\n--- Trying to require electron ---');
try {
  console.log('About to call require.resolve...');
  const resolved = require.resolve('electron');
  console.log('electron resolved to:', resolved);

  console.log('About to call require...');
  const electron = require('electron');
  console.log('electron required, typeof:', typeof electron);

  if (electron && typeof electron === 'object') {
    console.log('electron has app:', !!electron.app);
    console.log('electron has BrowserWindow:', !!electron.BrowserWindow);
    console.log('electron has ipcMain:', !!electron.ipcMain);
  } else {
    console.log('electron is not an object:', electron);
  }
} catch (e) {
  console.log('require electron failed:', e.message);
  console.log('error stack:', e.stack);
}