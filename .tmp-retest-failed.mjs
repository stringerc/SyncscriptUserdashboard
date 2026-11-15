import puppeteer from 'puppeteer';
const results = [];
const R = (n, ok, d='') => { results.push(ok); console.log(`${ok?'PASS':'FAIL'} ${n}${d?' — '+d:''}`); };
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));
const hist = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.()?.history || []);
const dbg = () => page.evaluate(() => { const d = window.__vizVoiceApi?.current?.debug?.(); return { t: d?.turnInFlight, s: d?.speaking, q: d?.queue }; });

async function turn(text, timeoutMs = 200000) {
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

// Give the pipeline a warm turn first
let r = await turn('Hey Cortex, quick check — are you there?');
console.log(`warmup: ${(r.ms/1000).toFixed(0)}s "${r.reply.slice(0,60)}"`);

r = await turn('Pin a stat panel that says TEST VALUE 42.');
R('pin artifact turn', r.reply !== '(TIMEOUT)' && !/glitch/i.test(r.reply), `${(r.ms/1000).toFixed(0)}s "${r.reply.slice(0,70)}"`);

r = await turn('Where are my panels?');
R('where panels (empty)', /no panels|nothing|ask me/i.test(r.reply), `"${r.reply.slice(0,80)}"`);

r = await turn('Move the panel to the top right.');
R('move panel (empty)', /nothing to move|no panels/i.test(r.reply), `"${r.reply.slice(0,80)}"`);

r = await turn('Go to sleep.');
R('guard: go to sleep', r.reply !== '(TIMEOUT)' && !/couldn.t find|geocod/i.test(r.reply), `"${r.reply.slice(0,70)}"`);

r = await turn('Keep it short.');
R('guard: keep it short', r.reply !== '(TIMEOUT)', `"${r.reply.slice(0,60)}"`);

r = await turn('Take me to Tokyo on the map.');
R('map fly', r.reply !== '(TIMEOUT)' && /tokyo|map|globe|fly|there/i.test(r.reply), `"${r.reply.slice(0,80)}"`);

console.log(`\n=== ${results.filter(Boolean).length}/${results.length} PASS ===`);
await browser.close();
