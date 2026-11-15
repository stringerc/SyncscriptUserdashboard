import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
const page = await browser.newPage();
page.on('console', m => { const t=m.text(); if(!/DevTools|Analytics|deprecated|mock tasks|edit history|archived|cookies|React Refresh|vite|THREE/.test(t)) console.log('['+m.type()+']', t.slice(0,220)); });
page.on('pageerror', e => console.log('[PAGEERR]', String(e).slice(0,300)));
page.on('requestfailed', r => console.log('[REQFAIL]', r.url().slice(0,120), r.failure()?.errorText));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 3000));
console.log('api type:', await page.evaluate(() => typeof window.__vizVoiceApi?.debug));
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'What is 2+2? One word answer.' })));
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const st = await page.evaluate(() => ({
    hist: window.__vizVoiceApi?.debug?.()?.history,
    speaking: document.body.innerText.includes('SPEAKING'),
    busy: document.body.innerText.match(/BUSY|QUEUED|THINKING/)?.[0] || '',
  }));
  console.log(`t=${i*2}s`, JSON.stringify(st).slice(0,300));
  if (st.hist?.some?.(h=>h.role==='assistant')) break;
}
await browser.close();
