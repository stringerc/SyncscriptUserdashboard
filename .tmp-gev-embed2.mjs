import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('['+m.type()+']', m.text().slice(0,180)));
page.on('pageerror', e => console.log('[PAGEERR]', String(e).slice(0,300)));
await page.evaluateOnNewDocument(() => {
  window.addEventListener('unhandledrejection', e => console.log('UNHANDLED:', String(e.reason).slice(0,200)));
  window.addEventListener('message', e => { if (e.data?.type?.startsWith('gev:')) console.log('GEVMSG>', e.data.type); });
});
const t0 = Date.now();
await page.goto('http://127.0.0.1:5180/?embed=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 4000));
  const st = await page.evaluate(() => ({
    readyState: document.readyState,
    cls: document.body.className,
    loader: document.getElementById('loaderStatus')?.textContent || document.querySelector('[class*=loader]')?.textContent || '',
    canvases: document.querySelectorAll('canvas').length,
  }));
  console.log(`t=${((Date.now()-t0)/1000).toFixed(0)}s`, JSON.stringify(st));
  if (st.canvases > 2) break;
}
await browser.close();
