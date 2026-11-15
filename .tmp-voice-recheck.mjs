import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));
const hist = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.()?.history || []);
const queue = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.()?.queue ?? 0);
for (const t of ['What is the weather like in Tokyo right now?', 'Remember that my favorite color is teal.', 'What is my favorite color?']) {
  const before = (await hist()).length;
  await page.evaluate((txt) => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: txt })), t);
  let reply = '';
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const h = await hist(); const q = await queue();
    const tail = h.slice(before);
    const ai = tail.filter(m => m.role === 'assistant').pop();
    if (ai && tail.some(m => m.role === 'user' && m.content === t) && q === 0) { reply = ai.content; break; }
  }
  console.log(`\nYOU: ${t}\nCORTEX: ${reply || '(TIMEOUT)'}`);
}
console.log('\nERRORS:', errs.length ? errs : 'none');
await browser.close();
