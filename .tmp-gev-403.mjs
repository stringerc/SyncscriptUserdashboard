import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('response', r => { if (r.status() >= 400) console.log(r.status(), r.url().slice(0,160)); });
page.on('pageerror', e => console.log('[PAGEERR]', String(e).slice(0,300)));
await page.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 10000));
// check WebGL canvas actually has content
const gl = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? { w: c.width, h: c.height } : null;
});
console.log('main canvas:', JSON.stringify(gl));
await browser.close();
