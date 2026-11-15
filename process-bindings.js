console.log('=== Process bindings ===');
console.log('process.versions.electron:', process.versions.electron);

// Try to get the list of bindings
if (typeof process._getActiveHandles === 'function') {
  console.log('_getActiveHandles:', typeof process._getActiveHandles);
}
if (typeof process._getActiveRequests === 'function') {
  console.log('_getActiveRequests:', typeof process._getActiveRequests);
}
if (typeof process._linkedBinding === 'function') {
  console.log('_linkedBinding:', typeof process._linkedBinding);
  try {
    const keys = Object.keys(process._linkedBinding());
    console.log('_linkedBinding keys:', keys);
  } catch (e) {
    console.log('_linkedBinding error:', e.message);
  }
}
if (typeof process.electronBinding === 'function') {
  console.log('electronBinding:', typeof process.electronBinding);
  try {
    const keys = Object.keys(process.electronBinding());
    console.log('electronBinding keys:', keys);
  } catch (e) {
    console.log('electronBinding error:', e.message);
  }
}

// Try to see if there is a way to get the electron module from process
console.log('\\n--- Trying to find electron in process ---');
for (const key in process) {
  if (key.toLowerCase().includes('electron')) {
    console.log(`process.${key}:`, typeof process[key]);
  }
}

// Try to see if there is a module._cache or similar that we can inspect
console.log('\\n--- Trying to inspect module cache ---');
const module = require('module');
console.log('module._cache keys:', Object.keys(module._cache).filter(k => k.includes('electron')).length);

// Try to see if we can require from a relative path
console.log('\\n--- Trying to require from relative paths ---');
const paths = [
  './node_modules/electron',
  '../node_modules/electron',
  '../../node_modules/electron',
];
for (const p of paths) {
  try {
    const resolved = require.resolve(p);
    console.log(`require.resolve('${p}'):`, resolved);
    const mod = require(p);
    console.log(`  required, typeof:`, typeof mod);
    if (mod && typeof mod === 'object') {
      console.log('  has app:', !!mod.app);
    }
  } catch (e) {
    console.log(`require.resolve('${p}') failed:`, e.message);
  }
}