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
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Pin a stat panel that says VISUAL CHECK 99.' })));
// wait for turn completion properly
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const d = await dbg();
  const ai = (d.history||[]).filter(m=>m.role==='assistant').pop();
  if (ai && !d.turnInFlight && !d.speaking) {
    console.log('REPLY:', ai.content.slice(0,120));
    break;
  }
}
await sleep(2000);
const info = await page.evaluate(() => {
  const panels = [...document.querySelectorAll('[role="region"][aria-label^="Panel:"]')].map(p => {
    const r = p.getBoundingClientRect(); const cs = getComputedStyle(p);
    return { label: p.getAttribute('aria-label'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      onscreen: r.width>50 && r.height>50 && cs.opacity !== '0',
      text: (p.innerText||'').replace(/\n/g,' | ').slice(0,100) };
  });
  return panels;
});
console.log('PANELS:', JSON.stringify(info, null, 1));
await page.screenshot({ path: '.audit-shots/14-panel-verify.png' });
await browser.close();
