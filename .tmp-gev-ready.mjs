import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.__gevReady = false;
  window.addEventListener('message', e => { if (e.data?.type === 'gev:ready') window.__gevReady = true; });
});
const t0 = Date.now();
await page.goto('http://127.0.0.1:5180/?embed=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const ready = await page.evaluate(() => window.__gevReady);
  console.log(`t=${((Date.now()-t0)/1000).toFixed(0)}s ready=${ready}`);
  if (ready) break;
}
await browser.close();
