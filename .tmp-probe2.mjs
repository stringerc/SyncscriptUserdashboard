import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('[ERR]', String(e).slice(0,200)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
// click VOICE toggle
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find(x => /VOICE/.test(x.textContent||''));
  if (b) { b.click(); return b.textContent.trim(); }
  return null;
});
console.log('voice toggle:', clicked);
await new Promise(r => setTimeout(r, 2000));
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Say hello in one word.' })));
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const dbg = await page.evaluate(() => window.__vizVoiceApi?.debug?.());
  if (dbg?.history?.some(h => h.role === 'assistant')) { console.log('HIST:', JSON.stringify(dbg.history)); break; }
  if (i === 29) console.log('TIMEOUT hist=', JSON.stringify(dbg?.history));
}
await browser.close();
