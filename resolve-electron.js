console.log('process.versions.electron:', process.versions.electron);
console.log('require.resolve(\'electron\'):');
try {
  const resolved = require.resolve('electron');
  console.log(resolved);
} catch (e) {
  console.log('Error:', e.message);
}