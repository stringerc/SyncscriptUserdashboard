import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('console', m => console.log('[pg]', m.type(), m.text().slice(0,180)));
page.on('pageerror', e => console.log('[ERR]', String(e).slice(0,200)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Say hello in one word.' })));
for (let i = 0; i < 25; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const dbg = await page.evaluate(() => window.__vizVoiceApi?.debug?.());
  const body = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log(`t=${i*2}s hist=`, JSON.stringify(dbg?.history?.slice(-2)), 'q=', dbg?.queue);
  if (dbg?.history?.some(h => h.role === 'assistant')) { console.log('REPLY:', JSON.stringify(dbg.history.at(-1))); break; }
}
await browser.close();
