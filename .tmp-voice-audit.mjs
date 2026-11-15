import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = []; const toolCalls = [];
page.on('request', r => { if (r.url().includes('/api/cortex/tools/execute')) toolCalls.push(r.postData()?.slice(0,150)||''); });
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0,200)); });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));

const turns = [
  'Hey Cortex, how are you doing today?',
  'What is the weather like in Tokyo right now?',
  'Remember that my favorite color is teal.',
  'What is my favorite color?',
  'Tell me a quick fun fact.',
];
const transcript = [];
for (const t of turns) {
  await page.evaluate((txt) => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: txt })), t);
  // wait for turn to finish: poll debug history until AI reply appears
  let reply = '';
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const dbg = await page.evaluate(() => window.__vizVoiceApi?.current?.debug?.() || null);
    const hist = dbg?.history || [];
    const last = hist[hist.length - 1];
    if (last && last.role === 'assistant' && last.content && last.content.length > 3) { reply = last.content; break; }
  }
  transcript.push({ you: t, cortex: reply || '(no reply captured)' });
  console.log('TURN DONE:', t.slice(0,40), '→', reply.slice(0,80));
}
console.log('\n=== FULL TRANSCRIPT ===');
for (const t of transcript) console.log(`\nYOU: ${t.you}\nCORTEX: ${t.cortex}`);
console.log('\nPAGE ERRORS:', errors.length ? errors : 'none');
await browser.close();
