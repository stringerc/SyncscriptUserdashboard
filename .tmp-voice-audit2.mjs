import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));

const hist = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.()?.history || []);
const queue = () => page.evaluate(() => window.__vizVoiceApi?.current?.debug?.()?.queue ?? 0);

const turns = [
  'Hey Cortex, how are you doing today?',
  'What is the weather like in Tokyo right now?',
  'Remember that my favorite color is teal.',
  'What is my favorite color?',
  'Tell me a quick fun fact.',
];
const out = [];
for (const t of turns) {
  const before = (await hist()).length;
  await page.evaluate((txt) => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: txt })), t);
  let reply = '';
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const h = await hist();
    const q = await queue();
    // done: new assistant entry exists after position `before`, queue empty
    const tail = h.slice(before);
    const ai = tail.filter(m => m.role === 'assistant').pop();
    const userSeen = tail.some(m => m.role === 'user' && m.content === t);
    if (ai && userSeen && q === 0) { reply = ai.content; break; }
  }
  out.push({ you: t, cortex: reply || '(TIMEOUT/no reply)' });
  console.log('DONE:', t.slice(0,45), '→', reply.slice(0,90));
}
console.log('\n=== TRANSCRIPT ===');
for (const t of out) console.log(`\nYOU: ${t.you}\nCORTEX: ${t.cortex}`);
console.log('\nERRORS:', errs.length ? errs : 'none');
await browser.close();
