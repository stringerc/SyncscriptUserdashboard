console.log('Starting simple electron test');
console.log('process.versions.electron:', process.versions.electron);

try {
  const electron = require('electron');
  console.log('require electron typeof:', typeof electron);
  if (electron && typeof electron === 'object') {
    console.log('electron has app:', !!electron.app);
    console.log('electron has BrowserWindow:', !!electron.BrowserWindow);
    const { app, BrowserWindow } = electron;
    console.log('Destructured app:', !!app);
    console.log('Destructured BrowserWindow:', !!BrowserWindow);
  } else {
    console.log('electron is not an object:', electron);
  }
} catch (e) {
  console.log('Error requiring electron:', e.message);
}