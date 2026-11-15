import puppeteer from 'puppeteer';
const URL = 'http://localhost:5173/cortex/visualizer';
const results = [];
const ok = (name, cond, extra='') => { results.push(`${cond?'PASS':'FAIL'} ${name}${extra?' — '+extra:''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1600,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

// 1. Telemetry rail honesty: UPTIME ticking, HOST=localhost, NET=LOCAL
const rail = await page.evaluate(() => document.body.innerText);
ok('rail UPTIME real', /UPTIME[\s\S]{0,40}\d+m \d\d?s/.test(rail), rail.match(/UPTIME[\s\S]{0,40}/)?.[0]);
ok('rail HOST real', rail.includes('localhost'), '');
ok('rail NET TLS/LOCAL', /NET[\s\S]{0,30}(LOCAL|TLS)/.test(rail), '');
ok('no hardcoded SF coords as live', !rail.includes('37.7749°N // 122.4194°W'), '');

// 2. Focus mode chip + Escape
await page.evaluate(() => {
  const ls = JSON.parse(localStorage.getItem('cortex-surfaces') || '{}');
});
// enable focus via store: dispatch through localStorage won't trigger; use the bus? Instead check module:
const hasFocusFn = await page.evaluate(() => typeof window !== 'undefined');
// Toggle focus mode through the app: panels needed? focusMode chip shows whenever focusMode true.
// Set via localStorage then reload.
await page.evaluate(() => {
  const raw = localStorage.getItem('cortex-surfaces');
  const st = raw ? JSON.parse(raw) : { panels: [], focusMode: false };
  st.focusMode = true;
  localStorage.setItem('cortex-surfaces', JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2500));
let chip = await page.evaluate(() => document.body.innerText.includes('FOCUS · ESC'));
ok('focus chip visible', chip);
await page.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 400));
chip = await page.evaluate(() => document.body.innerText.includes('FOCUS · ESC'));
ok('Escape exits focus', !chip);

// 3. Surface-full notice: seed 6 panels then fire pin event
await page.evaluate(() => {
  const art = { kind:'stat', title:'T', value:'1', label:'x' };
  for (let i=0;i<6;i++) window.dispatchEvent(new CustomEvent('cortex-pin-artifact', { detail: {...art, id:'a'+i, title:'P'+i} }));
  window.dispatchEvent(new CustomEvent('cortex-pin-artifact', { detail: {...art, id:'a7', title:'SEVENTH'} }));
});
await new Promise(r => setTimeout(r, 800));
const notice = await page.evaluate(() => document.body.innerText.includes('SURFACE FULL'));
ok('surface-full notice', notice);
const panelCount = await page.evaluate(() => (document.body.innerText.match(/PANELS (\d+)/)||[])[1]);
ok('panel count indicator', panelCount === '06', 'got '+panelCount);

// 4. Drop preview + keyboard nudge: focus a panel grip, arrow at edge
const gripInfo = await page.evaluate(() => {
  const g = document.querySelector('.cx-panel-grip');
  if (!g) return null;
  g.focus();
  return g.getAttribute('aria-label');
});
ok('panel grip focusable', !!gripInfo, gripInfo||'');
// press ArrowLeft many times to hit edge then check nudge border (boxShadow cyan ring)
for (let i=0;i<4;i++) await page.keyboard.press('ArrowLeft');
await new Promise(r => setTimeout(r, 300));
const nudge = await page.evaluate(() => {
  const el = document.querySelector('[role="region"]');
  return el ? getComputedStyle(el.firstElementChild).boxShadow : '';
});
ok('edge nudge feedback', nudge.includes('103, 232, 249') || nudge.includes('103,232,249'), nudge.slice(0,60));

// 5. Narrow viewport
await page.setViewport({ width: 480, height: 800 });
await new Promise(r => setTimeout(r, 1200));
const narrow = await page.evaluate(() => {
  const nav = [...document.querySelectorAll('a,button')].find(e => e.textContent.includes('OPEN CHAT'));
  const railHidden = !document.body.innerText.includes('Φ IIT') || true;
  return { navVisible: !!nav, overflow: document.documentElement.scrollWidth > window.innerWidth + 2 };
});
ok('narrow: no horizontal overflow', !narrow.overflow);

// 6. Reduced motion
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.setViewport({ width: 1600, height: 900 });
await new Promise(r => setTimeout(r, 800));
const rm = await page.evaluate(() => {
  const el = document.querySelector('[class*="cx-hud-in"], div');
  // find scanline overlay by animation style
  const all = [...document.querySelectorAll('div')];
  const scan = all.find(d => (d.getAttribute('style')||'').includes('cx-scan-drift'));
  return { scanAnim: scan ? getComputedStyle(scan).animationName : 'none-found' };
});
ok('reduced-motion disables scan drift', rm.scanAnim === 'none', rm.scanAnim);

// 7. Globe uplink/probe — MAP button should appear (GEV ping live)
const mapBtn = await page.evaluate(() => document.body.innerText.includes('MAP'));
ok('MAP control visible (gev ping ok)', mapBtn);

console.log(results.join('\n'));
console.log('PAGE ERRORS:', errors.length ? errors.slice(0,5) : 'none');
await browser.close();
