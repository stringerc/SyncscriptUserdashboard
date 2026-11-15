import puppeteer from 'puppeteer';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 900 });
page.on('console', m => { const t=m.text(); if(/viz-voice|tool/i.test(t)) console.log('CON:',t.slice(0,200)); });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(3000);
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await sleep(2000);
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Pin a stat panel that says VISUAL CHECK 99.' })));
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const d = await page.evaluate(() => window.__vizVoiceApi?.current?.debug?.() || {});
  const ai = (d.history||[]).filter(m=>m.role==='assistant').pop();
  if (ai && !d.turnInFlight && !d.speaking) {
    console.log('\n=== FULL HISTORY ===');
    for (const m of d.history) console.log(`[${m.role}]`, String(m.content).slice(0,300));
    const panels = await page.evaluate(() => document.querySelectorAll('[role="region"][aria-label^="Panel:"]').length);
    console.log('PANELS:', panels);
    break;
  }
}
await browser.close();
