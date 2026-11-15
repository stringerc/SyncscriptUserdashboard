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
const panels = () => page.evaluate(() => [...document.querySelectorAll('[role="region"][aria-label^="Panel:"]')].map(p=>p.getAttribute('aria-label')));
const turn = async (text, maxWait=100000) => {
  const before = (await dbg()).history?.length || 0;
  await page.evaluate((t) => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: t })), text);
  for (let i = 0; i < maxWait/2000; i++) {
    await sleep(2000);
    const d = await dbg();
    const tail = (d.history||[]).slice(before);
    const ai = tail.filter(m=>m.role==='assistant').pop();
    if (ai && !d.turnInFlight && !d.speaking) return ai.content;
  }
  return '(TIMEOUT)';
};
// Seed an image panel via pin flow: ask for image artifact then pin it
console.log('>>> generate neon atom image');
let r = await turn('Generate an image of a neon atom.', 120000);
console.log('<<<', r.slice(0,120));
console.log('>>> pin that');
r = await turn('Pin that.', 60000);
console.log('<<<', r.slice(0,120));
console.log('panels:', await panels());
console.log('>>> remove picture of a neon atom');
r = await turn('Can you remove picture of a neon atom?', 60000);
console.log('<<<', r.slice(0,140));
console.log('panels after:', await panels());
await browser.close();
