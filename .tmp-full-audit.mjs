import puppeteer from 'puppeteer';
const results = [];
const R = (name, ok, detail='') => { results.push({name, ok, detail}); console.log(`${ok?'PASS':'FAIL'} ${name}${detail?' — '+detail:''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,120)));
// Vite full-reloads the page when vite.config.ts changes (HMR of config) —
// retry evaluates that hit a destroyed execution context.
async function safeEval(fn, ...args) {
  for (let i = 0; i < 15; i++) {
    try { return await page.evaluate(fn, ...args); }
    catch (e) {
      if (!/Execution context was destroyed|Cannot find context/.test(String(e))) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('page never recovered from reload');
}
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await safeEval(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));

const hist = () => safeEval(() => window.__vizVoiceApi?.current?.debug?.()?.history || []);

async function turn(text, timeoutMs = 120000) {
  const before = (await hist()).length;
  const t0 = Date.now();
  await safeEval((txt) => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: txt })), text);
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

const panelCount = () => safeEval(() => document.querySelectorAll('[role="region"][aria-label^="Panel:"]').length);

// ── 1. Basics ──
let r = await turn('Hey Cortex, how are you?');
R('basic conversation', r.reply !== '(TIMEOUT)' && r.reply.length > 10, `${(r.ms/1000).toFixed(1)}s "${r.reply.slice(0,60)}"`);

// ── 2. Memory ──
r = await turn('Remember that my test codename is ORANGE-FALCON-7.');
R('memory save', r.reply !== '(TIMEOUT)' && !/glitch|missed that/i.test(r.reply), `"${r.reply.slice(0,70)}"`);
r = await turn('What is my test codename?');
R('memory recall', /orange|falcon/i.test(r.reply), `"${r.reply.slice(0,80)}"`);

// ── 3. Tools ──
r = await turn('What is the system uptime? Use your tools.');
R('system_info tool', r.reply !== '(TIMEOUT)' && /hour|minute|up|day/i.test(r.reply) && !/tool_call|```|\{"type"/.test(r.reply), `"${r.reply.slice(0,80)}"`);

// ── 4. Surface panels ──
r = await turn('Pin a stat panel that says TEST VALUE 42.');
await new Promise(r2 => setTimeout(r2, 2500));
const pc = await panelCount();
R('pin artifact panel', pc > 0, `panels=${pc} "${r.reply.slice(0,60)}"`);
r = await turn('Where are my panels?');
R('where panels', r.reply !== '(TIMEOUT)' && /panel|docked|top|middle|bottom|left|right|center/i.test(r.reply), `"${r.reply.slice(0,70)}"`);
r = await turn('Move the panel to the top right.');
R('move panel', r.reply !== '(TIMEOUT)', `"${r.reply.slice(0,70)}"`);

// ── 5. Grammar guards ──
r = await turn('Go to sleep.');
R('guard: go to sleep', r.reply !== '(TIMEOUT)' && !/couldn.t find|geocod/i.test(r.reply), `"${r.reply.slice(0,70)}"`);
r = await turn('Keep it short.');
R('guard: keep it short', r.reply !== '(TIMEOUT)', `"${r.reply.slice(0,60)}"`);

// ── 6. Map ──
r = await turn('Take me to Tokyo on the map.');
R('map fly command', r.reply !== '(TIMEOUT)' && /tokyo|map|globe|fly|there/i.test(r.reply), `"${r.reply.slice(0,80)}"`);

// ── 7. Chart artifact ──
r = await turn('Show me a bar chart of my week: mon 3, tue 5, wed 2, thu 7, fri 4.');
await new Promise(r2 => setTimeout(r2, 3000));
R('chart artifact', r.reply !== '(TIMEOUT)' && !/tool_call|```|\{"type"/.test(r.reply), `"${r.reply.slice(0,80)}"`);

// ── 8. Telemetry ──
const rail = await safeEval(() => document.body.innerText.match(/UPTIME[^\n]*|HOST[^\n]*|PANELS[^\n]*/g)?.slice(0,4));
R('telemetry rail', !!rail?.length, JSON.stringify(rail));

console.log('\n=== ERRORS ===', errs.length ? errs.slice(0,5) : 'none');
console.log(`\n=== ${results.filter(x=>x.ok).length}/${results.length} PASS ===`);
await browser.close();
