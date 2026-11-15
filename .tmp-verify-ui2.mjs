import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 3000));
const rm = await page.evaluate(() => {
  const scan = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style')||'').includes('repeating-linear-gradient'));
  return scan ? getComputedStyle(scan).animationName : 'not-found';
});
console.log('scanlines animationName:', rm, rm === 'none' ? 'PASS' : 'FAIL');
// focus chip with correct storage key
await page.evaluate(() => localStorage.setItem('cortex-surface-panels-v1', JSON.stringify({ panels: [], focusMode: true })));
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2500));
const chip = await page.evaluate(() => document.body.innerText.includes('FOCUS · ESC'));
console.log('focus chip:', chip ? 'PASS' : 'FAIL');
await page.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 400));
const after = await page.evaluate(() => document.body.innerText.includes('FOCUS · ESC'));
console.log('escape exits:', !after ? 'PASS' : 'FAIL');
await browser.close();
