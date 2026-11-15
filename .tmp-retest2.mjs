import puppeteer from 'puppeteer';
const results = [];
const R = (n, ok, d='') => { results.push(ok); console.log(`${ok?'PASS':'FAIL'} ${n}${d?' — '+d:''}`); };
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('pageerror', e => console.log('PAGEERR:', String(e).slice(0,100)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));
const hist = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.()?.history || []);
async function turn(text, timeoutMs = 150000) {
  const before = (await hist()).length;
  const t0 = Date.now();
  await page.evaluate((txt) => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: txt })), text);
  for (let i = 0; i < timeoutMs/1000; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const h = await hist();
    const tail = h.slice(before);
    const ui = tail.findIndex(m => m.role === 'user' && m.content === text);
    if (ui === -1) continue;
    const ai = tail.slice(ui + 1).filter(m => m.role === 'assistant').pop();
    if (ai) return { reply: ai.content, ms: Date.now()-t0 };
  }
  return { reply: '(TIMEOUT)', ms: Date.now()-t0 };
}
let r = await turn('Hey Cortex, are you there?');
console.log(`warmup ${(r.ms/1000).toFixed(0)}s "${r.reply.slice(0,50)}"`);
r = await turn('Go to sleep.');
R('guard: go to sleep', r.reply !== '(TIMEOUT)' && !/couldn.t find|geocod/i.test(r.reply), `${(r.ms/1000).toFixed(0)}s "${r.reply.slice(0,70)}"`);
r = await turn('Keep it short.');
R('guard: keep it short', r.reply !== '(TIMEOUT)', `${(r.ms/1000).toFixed(0)}s "${r.reply.slice(0,60)}"`);
r = await turn('Take me to Tokyo on the map.');
R('map fly', r.reply !== '(TIMEOUT)' && /tokyo|map|globe|fly|there/i.test(r.reply), `${(r.ms/1000).toFixed(0)}s "${r.reply.slice(0,80)}"`);
r = await turn('What time is it in London?');
R('world time', r.reply !== '(TIMEOUT)' && /london|am|pm|:|o.clock|hour/i.test(r.reply), `"${r.reply.slice(0,80)}"`);
r = await turn('Tell me a joke.');
R('chitchat', r.reply !== '(TIMEOUT)' && r.reply.length > 15, `"${r.reply.slice(0,70)}"`);
console.log(`\n=== ${results.filter(Boolean).length}/${results.length} PASS ===`);
await browser.close();
