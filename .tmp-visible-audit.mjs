import puppeteer from 'puppeteer';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = '/Users/Apple/syncscript/.audit-shots';
const results = [];
const R = (n, ok, d='') => { results.push({n,ok}); console.log(`${ok?'PASS':'FAIL'} ${n}${d?' — '+d:''}`); };

const browser = await puppeteer.launch({
  headless: false,
  args: ['--window-size=1500,950', '--window-position=60,40', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
  defaultViewport: null,
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0,150)));

console.log('=== CORTEX LIVE VISUAL AUDIT ===');
console.log('Watch the window — Cortex will speak each reply out loud.');
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 40000 });
await sleep(4000);
await page.screenshot({ path: `${SHOTS}/01-loaded.png` });

// Enable voice
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await sleep(3000);
await page.screenshot({ path: `${SHOTS}/02-voice-on.png` });

const dbg = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.() || {});
const panels = () => page.evaluate(() => document.querySelectorAll('[role="region"][aria-label^="Panel:"]').length);
const turn = async (text, shot, waitMs=9000) => {
  console.log(`\n>>> YOU: "${text}"`);
  await page.evaluate((t) => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: t })), text);
  await sleep(waitMs);
  const d = await dbg();
  const ai = (d.history||[]).filter(m=>m.role==='assistant').pop();
  console.log(`<<< CORTEX: "${(ai?.content||'(pending)').slice(0,140)}"`);
  console.log(`    state: inflight=${d.turnInFlight} speaking=${d.speaking} panels=${await panels()}`);
  await page.screenshot({ path: `${SHOTS}/${shot}.png` });
  return ai?.content || '';
};

// 1. Conversation
let r = await turn('Hey Cortex, how are you feeling today?', '03-chat');
R('conversation', r.length > 10 && !/missed that|glitch/i.test(r), r.slice(0,60));

// 2. Memory save + recall
r = await turn('Remember that my project codename is CRIMSON-OTTER-9.', '04-memory-save', 12000);
R('memory save', !/missed that|glitch/i.test(r), r.slice(0,60));
r = await turn('What is my project codename?', '05-memory-recall', 12000);
R('memory recall', /crimson|otter/i.test(r), r.slice(0,60));

// 3. Tool use
r = await turn('Run system_info and tell me the uptime.', '06-system-info', 15000);
R('system_info tool', /up|hour|day|load/i.test(r) && !/```|\{"type"/.test(r), r.slice(0,70));

// 4. Artifact → pin
r = await turn('Pin a stat panel that says AUDIT VALUE 77.', '07-pin-stat', 15000);
const pc1 = await panels();
R('pin stat panel', pc1 > 0, `panels=${pc1} "${r.slice(0,60)}"`);

// 5. Where are my panels
r = await turn('Where are my panels docked?', '08-where-panels', 12000);
R('panel locate', /panel|docked|top|left|right|center|middle|bottom/i.test(r), r.slice(0,70));

// 6. Chart artifact
r = await turn('Show me a bar chart of my week: mon 3, tue 5, wed 2, thu 7, fri 4.', '09-chart', 18000);
const pc2 = await panels();
R('chart artifact', !/missed that|glitch/i.test(r), `panels=${pc2} "${r.slice(0,60)}"`);

// 7. Map fly
r = await turn('Take me to Paris on the map.', '10-map-paris', 25000);
R('map fly', !/missed that|glitch|couldn.t find/i.test(r), r.slice(0,70));
await sleep(6000);
await page.screenshot({ path: `${SHOTS}/11-map-settled.png` });

// 8. Grammar guard
r = await turn('Go to sleep.', '12-guard-sleep', 12000);
R('guard: go to sleep', !/geocod|couldn.t find a place/i.test(r), r.slice(0,60));

// 9. Focus mode visual
await page.evaluate(() => {
  // click FOCUS chip if present, else dispatch surface focus via keyboard is complex — screenshot whatever state
});
await sleep(1000);
await page.screenshot({ path: `${SHOTS}/13-final-state.png` });

console.log('\n=== ERRORS ===', errs.length ? errs.slice(0,5) : 'none');
console.log(`=== ${results.filter(x=>x.ok).length}/${results.length} PASS ===`);
console.log('Screenshots in .audit-shots/ — browser stays open for inspection.');
await sleep(15000); // let user look
await browser.close();
