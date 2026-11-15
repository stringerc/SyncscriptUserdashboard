import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=metal']
});
const page = await browser.newPage({viewport:{width:1600,height:900}});
page.on('console', m => { const t=m.text(); if(/error|fail|unavailable|ais|3d|token/i.test(t)) console.log('['+m.type()+']', t.slice(0,160)); });
page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0,200)));
page.on('requestfailed', r => { if(r.url().includes('5180')) console.log('REQFAIL', r.url().slice(0,90), r.failure()?.errorText); });
await page.goto('http://localhost:5173/cortex/visualizer?map=1', {waitUntil:'domcontentloaded'});
await page.waitForTimeout(30000);
const gev = page.frames().find(f=>f.url().includes('5180'));
console.log('GEV frame:', gev ? gev.url().slice(0,80) : 'MISSING');
if (gev) console.log('canvases:', await gev.locator('canvas').count());
await page.screenshot({path:'/tmp/gev-now.png'});
await browser.close();
