import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
const page = await browser.newPage();
page.on('console', m => { const t=m.text(); if(/viz-voice|Speech|recognition|mic/i.test(t)) console.log('[pg]',t.slice(0,160)); });
page.on('pageerror', e => console.log('[ERR]', String(e).slice(0,200)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
const r1 = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/VOICE|MIC/i.test(t));
  return btns;
});
console.log('voice-ish buttons:', JSON.stringify(r1));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 1500));
const r2 = await page.evaluate(() => [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/VOICE|LISTEN|●|◌/i.test(t)).slice(0,6));
console.log('after click:', JSON.stringify(r2), 'api=', await page.evaluate(() => typeof window.__vizVoiceApi));
await browser.close();
