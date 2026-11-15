import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => { const t = m.text(); if (/viz-voice|tts|kokoro|pocket|tool|error|fail|artifact/i.test(t)) console.log('CON:', t.slice(0,180)); });
page.on('requestfailed', r => console.log('REQFAIL:', r.url().slice(-70), r.failure()?.errorText));
page.on('response', r => { const u=r.url(); if (/tools\/execute|ai\/tts|chat-append|ai\/chat|ai\/stream/.test(u)) console.log(`NET ${r.status()} ${u.slice(-55)}`); });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));

const t0 = Date.now();
const el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Pin a stat panel that says TEST VALUE 42.' })));
for (let i = 0; i < 24; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const d = await page.evaluate(() => window.__vizVoiceApi?.current?.debug?.() ?? null).catch(()=>null);
  console.log(`[${el()}]`, JSON.stringify({ q: d?.queue, p: d?.priority, hist: d?.history?.map(m=>m.role+':'+m.content.slice(0,40)) }));
}
await browser.close();
