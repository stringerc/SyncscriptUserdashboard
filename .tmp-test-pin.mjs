import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('console', m => { const t=m.text(); if(/viz-voice|error|fail/i.test(t)) console.log('CON:', t.slice(0,160)); });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));
const dbg = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.() || {});
const t0 = Date.now(); const el=()=>((Date.now()-t0)/1000).toFixed(0)+'s';
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Pin a stat panel that says TEST VALUE 42.' })));
for (let i = 0; i < 150; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const d = await dbg().catch(()=>({}));
  const h = d.history || [];
  const tail = h.slice(-3).map(m=>m.role+':'+String(m.content).slice(0,70));
  console.log(`[${el()}] inflight=${d.turnInFlight} speaking=${d.speaking} q=${d.queue}`, JSON.stringify(tail));
  const ai = h.filter(m=>m.role==='assistant').pop();
  if (ai && !d.turnInFlight && !d.speaking && i > 3) {
    const panels = await page.evaluate(() => document.querySelectorAll('[role="region"][aria-label^="Panel:"]').length);
    console.log(`DONE panels=${panels} reply="${ai.content.slice(0,120)}"`);
    break;
  }
}
await browser.close();
