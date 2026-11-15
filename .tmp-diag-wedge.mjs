import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => { const t=m.text(); if (/viz-voice|dev-proxy|error/i.test(t)) console.log('CON:', t.slice(0,150)); });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));
const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
const fire = (txt) => page.evaluate((t) => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: t })), txt);
await fire('Pin a stat panel that says TEST VALUE 42.');
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const d = await page.evaluate(() => { const x = window.__vizVoiceApi?.current?.debug?.(); return x ? { q:x.queue, p:x.priority, t:x.turnInFlight, s:x.speaking, last: x.history?.slice(-2).map(m=>m.role+':'+String(m.content).slice(0,50)) } : null; }).catch(()=>null);
  console.log(`[${el()}]`, JSON.stringify(d));
}
await browser.close();
