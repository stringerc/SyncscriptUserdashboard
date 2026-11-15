import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => { const t = m.text(); if (/tts|kokoro|pocket|error|fail/i.test(t)) console.log('CON:', t.slice(0,160)); });
page.on('response', r => { if (/\/api\/ai\/tts|cortex/.test(r.url())) console.log('NET:', r.status(), r.url().slice(-60)); });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await page.evaluate(() => { [...document.querySelectorAll('button')].find(x=>/VOICE/.test(x.textContent||''))?.click(); });
await new Promise(r => setTimeout(r, 2500));

const dump = async (tag) => {
  const d = await page.evaluate(() => {
    const api = window.__vizVoiceApi?.current;
    const bus = window.__cortexSignalBus ? 'has-bus' : 'no-bus';
    return { dbg: api?.debug?.() ?? null, bus };
  }).catch(e => ({ err: String(e) }));
  console.log(`\n=== ${tag} ===`, JSON.stringify(d, null, 1).slice(0, 2000));
};

await dump('after-load');
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Hey Cortex, how are you?' })));
for (let i = 0; i < 30; i++) { await new Promise(r=>setTimeout(r,1000)); if (i%5===4) await dump(`t+${i+1}s`); }
await dump('final');
await browser.close();
