import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
page.on('console', m => { if (['error','warning'].includes(m.type())) console.log('['+m.type()+']', m.text().slice(0,200)); });
page.on('pageerror', e => console.log('[PAGEERR]', String(e).slice(0,300)));
page.on('requestfailed', r => console.log('[REQFAIL]', r.url().slice(0,140)));
await page.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 8000));
const state = await page.evaluate(() => ({
  title: document.title,
  canvas: document.querySelectorAll('canvas').length,
  bodyText: document.body.innerText.slice(0, 300),
  iframe: !!document.querySelector('iframe'),
}));
console.log('STATE:', JSON.stringify(state, null, 1));
await page.screenshot({ path: '/tmp/gev-check.png' });
await browser.close();
