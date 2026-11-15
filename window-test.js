console.log('=== Window Test ===');
console.log('process.versions.electron:', process.versions.electron);

// Try the most basic electron usage
try {
  const { app, BrowserWindow } = require('electron');
  console.log('Successfully destructured electron');
  console.log('app:', !!app);
  console.log('BrowserWindow:', !!BrowserWindow);

  app.whenReady().then(() => {
    console.log('App is ready!');
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true
      }
    });
    win.loadFile('index.html');
  });

} catch (e) {
  console.log('Error:', e.message);
  console.log('Stack:', e.stack);

  // Let's try to see what require actually is
  console.log('typeof require:', typeof require);
  console.log('require.toString():', require.toString().substring(0, 100));
}