import puppeteer from 'puppeteer';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const R = (n, ok, d='') => { results.push(ok); console.log(`${ok?'PASS':'FAIL'} ${n}${d?' — '+d:''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--deny-permission-prompts','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 900 });
page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0,120)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(3500);
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await sleep(2500);

const vis = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { found: true, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05,
    inViewport: r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight,
    color: cs.color, bg: cs.backgroundColor.slice(0,40) };
}, sel);

// 1. Visualizer canvas/orb actually rendering
const canvas = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? { w: c.width, h: c.height } : null;
});
R('webgl canvas rendering', !!canvas && canvas.w > 100, JSON.stringify(canvas));

// 2. Voice state chip visible
const stateChip = await vis('[class*="state"], [data-state]');
// find the state label text instead
const stateText = await page.evaluate(() => {
  const m = document.body.innerText.match(/(LISTENING|THINKING|SPEAKING|IDLE|WORKING)/);
  return m ? m[1] : null;
});
R('voice state label visible', !!stateText, stateText || 'none');

// 3. Telemetry rail visible with real values
const rail = await page.evaluate(() => {
  const t = document.body.innerText;
  return { uptime: /UPTIME[^\n]{0,40}/.exec(t)?.[0], host: /HOST[^\n]{0,40}/.exec(t)?.[0], panels: /PANELS[^\n]{0,20}/.exec(t)?.[0] };
});
R('telemetry rail populated', !!rail.uptime && !!rail.host, JSON.stringify(rail));

// 4. Run a turn and check speaking-state visuals mid-flight
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Tell me a one sentence fun fact.' })));
await sleep(2500);
const midState = await page.evaluate(() => document.body.innerText.match(/(LISTENING|THINKING|SPEAKING|WORKING|IDLE)/)?.[1]);
const caption = await page.evaluate(() => {
  // the caption/chyron element — find smallest visible text near bottom-center
  const els = [...document.querySelectorAll('div,span,p')].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 100 && r.width < 900 && r.top > innerHeight*0.55 && r.top < innerHeight*0.8 && e.children.length === 0 && (e.textContent||'').trim().length > 10;
  });
  return els.slice(-2).map(e => e.textContent.trim().slice(0,80));
});
R('mid-turn state label', !!midState, `${midState} caption=${JSON.stringify(caption)}`);
await sleep(9000);

// 5. Pin a panel — verify it has real geometry on screen
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Pin a stat panel that says VISUAL CHECK 99.' })));
await sleep(14000);
const panelGeo = await page.evaluate(() => {
  const panels = [...document.querySelectorAll('[role="region"][aria-label^="Panel:"]')];
  return panels.map(p => {
    const r = p.getBoundingClientRect();
    const cs = getComputedStyle(p);
    return { label: p.getAttribute('aria-label'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      onscreen: r.width>50 && r.height>50 && r.right>0 && r.bottom>0 && r.left<innerWidth && r.top<innerHeight && cs.opacity !== '0' };
  });
});
R('panel rendered onscreen', panelGeo.length > 0 && panelGeo.every(p => p.onscreen), JSON.stringify(panelGeo));

// 6. Panel content actually has text/svg (not an empty box)
const panelContent = await page.evaluate(() => {
  const p = document.querySelector('[role="region"][aria-label^="Panel:"]');
  if (!p) return null;
  return { text: (p.innerText||'').slice(0,80), svgs: p.querySelectorAll('svg').length, imgs: p.querySelectorAll('img').length };
});
R('panel has content', !!panelContent && (panelContent.text.length > 3 || panelContent.svgs > 0 || panelContent.imgs > 0), JSON.stringify(panelContent));

// 7. Chat drawer transcript visible
const drawerText = await page.evaluate(() => document.body.innerText.slice(0, 400));
R('transcript populated', /cortex|you|audit|visual/i.test(drawerText), drawerText.slice(0,60).replace(/\n/g,' '));

// 8. Globe iframe state (should NOT be open — verify no dead iframe)
const iframe = await page.evaluate(() => {
  const f = document.querySelector('iframe[data-gev-globe]');
  return f ? { src: f.src.slice(0,50), visible: f.getBoundingClientRect().width > 100 } : null;
});
R('no phantom globe iframe', !iframe || iframe.visible === false || iframe.src.includes('5180'), JSON.stringify(iframe));

console.log(`\n=== ${results.filter(Boolean).length}/${results.length} VISUAL CHECKS PASS ===`);
await browser.close();
