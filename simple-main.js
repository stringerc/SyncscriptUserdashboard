console.log('Starting simple-main.js');
console.log('process.versions:', JSON.stringify(process.versions, null, 2));
console.log('process.type:', process.type);

const electron = require('electron');
console.log('typeof electron:', typeof electron);
if (typeof electron === 'string') {
  console.log('electron is string:', electron);
} else if (electron) {
  console.log('electron is object with keys:', Object.keys(electron));
}

const { app, BrowserWindow } = electron;
console.log('app:', !!app);
console.log('BrowserWindow:', !!BrowserWindow);