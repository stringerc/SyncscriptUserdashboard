import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
const page = await browser.newPage();
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'What is 2+2? Answer briefly.' })));
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const dbg = await page.evaluate(() => window.__vizVoiceApi?.debug?.());
  console.log(`t=${i*3}s`, JSON.stringify(dbg?.history?.slice(-2)));
  if (dbg?.history?.some(h=>h.role==='assistant')) break;
}
await browser.close();
