import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));
const hist = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.()?.history || []);
const t0 = Date.now(); const el=()=>((Date.now()-t0)/1000).toFixed(0)+'s';
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Take me to Tokyo on the map.' })));
for (let i = 0; i < 100; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const h = await hist();
  const tail = h.slice(-4).map(m=>m.role+':'+String(m.content).slice(0,60));
  console.log(`[${el()}]`, JSON.stringify(tail));
  if (tail.some(x=>x.startsWith('assistant:'))) break;
}
await browser.close();
