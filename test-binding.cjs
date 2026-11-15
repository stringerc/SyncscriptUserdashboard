// Test what process._linkedBinding returns

console.log('=== Testing process._linkedBinding ===');
console.log('process.versions.electron:', process.versions.electron);
console.log('typeof process._linkedBinding:', typeof process._linkedBinding);

if (typeof process._linkedBinding === 'function') {
  try {
    const result = process._linkedBinding('electron');
    console.log('process._linkedBinding(\'electron\') result:', result);
    console.log('typeof result:', typeof result);
    if (result !== null && typeof result === 'object') {
      console.log('result.app:', !!result.app);
      console.log('result.BrowserWindow:', !!result.BrowserWindow);
      console.log('result.ipcMain:', !!result.ipcMain);

      // If we found it, let's try to use it
      if (result.app || result.BrowserWindow || result.ipcMain) {
        console.log('SUCCESS: Found electron module via _linkedBinding!');
        module.exports = result;
      }
    }
  } catch (e) {
    console.log('process._linkedBinding(\'electron\') threw:', e.message);
  }
} else {
  console.log('process._linkedBinding is not a function');
}

// Also try to see what bindings are available
console.log('\n=== Checking for available bindings ===');
try {
  // This might not work, but let's see
  const mod = require('module');
  if (mod && mod._load) {
    console.log('module._load exists');
  }
} catch (e) {
  console.log('Error checking module:', e.message);
}

// Try to see if we can get electron from process directly
console.log('\n=== Checking process for electron ===');
if (process.electron) {
  console.log('process.electron exists:', typeof process.electron);
} else {
  console.log('process.electron does not exist');
}

// Check for electron in global
console.log('\n=== Checking global for electron ===');
if (global.electron) {
  console.log('global.electron exists:', typeof global.electron);
} else {
  console.log('global.electron does not exist');
}