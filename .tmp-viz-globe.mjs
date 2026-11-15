import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('console', m => { if (['error'].includes(m.type())) console.log('[err]', m.text().slice(0,160)); });
page.on('pageerror', e => console.log('[PAGEERR]', String(e).slice(0,200)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
// find and click MAP/globe button
const btn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /MAP|GLOBE|◉|🌐/i.test(x.textContent||''));
  if (b) { b.click(); return b.textContent.trim().slice(0,40); }
  return [...document.querySelectorAll('button')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,15);
});
console.log('clicked:', JSON.stringify(btn));
await new Promise(r => setTimeout(r, 25000));
const st = await page.evaluate(() => ({
  iframe: !!document.querySelector('iframe[data-gev-globe]'),
  iframeSrc: document.querySelector('iframe[data-gev-globe]')?.src || null,
  uplink: document.body.innerText.includes('ESTABLISHING UPLINK'),
  failed: document.body.innerText.match(/globe.*(?:fail|retry|unavailable)/i)?.[0] || '',
  readyText: document.body.innerText.slice(0, 200),
}));
console.log('STATE:', JSON.stringify(st, null, 1));
await page.screenshot({ path: '/tmp/viz-globe.png' });
await browser.close();
