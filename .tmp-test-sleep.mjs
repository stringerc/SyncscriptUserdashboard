import puppeteer from 'puppeteer';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 900 });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(3000);
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await sleep(2000);
const dbg = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.() || {});
// Mount globe first (this is what made "go to sleep" fly to Ten Sleep)
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Open the map.' })));
await sleep(18000);
// Now the killer phrase while globe context is live
const before = (await dbg()).history?.length || 0;
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Go to sleep.' })));
for (let i = 0; i < 60; i++) {
  await sleep(2000);
  const d = await dbg();
  const tail = (d.history||[]).slice(before);
  const ai = tail.filter(m=>m.role==='assistant').pop();
  if (ai && !d.turnInFlight) {
    console.log('REPLY:', ai.content.slice(0,140));
    console.log(/ten sleep|wyoming/i.test(ai.content) ? 'FAIL: flew to Ten Sleep' : 'PASS: no geocode hijack');
    break;
  }
}
await browser.close();
