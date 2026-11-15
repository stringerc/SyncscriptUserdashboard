import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
const page = await browser.newPage();
page.on('console', m => { const t=m.text(); if(/viz-voice|TTS|tool|error|fail|llm/i.test(t)) console.log('['+m.type()+']', t.slice(0,200)); });
page.on('pageerror', e => console.log('[PAGEERR]', String(e).slice(0,200)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Remember that my favorite color is teal.' })));
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const h = await page.evaluate(() => window.__vizVoiceApi?.current?.debug?.()?.history || []);
  const ai = h.filter(m=>m.role==='assistant').pop();
  console.log(`t=${i*3}s hist=${h.length} last=${ai ? ai.content.slice(0,80) : '-'}`);
  if (ai && /teal|remember|color/i.test(ai.content)) break;
}
await browser.close();
