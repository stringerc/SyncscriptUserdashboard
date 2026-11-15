import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required','--window-size=1600,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: '+m.text().slice(0,200)); });
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
// enable voice via mic button? VOICE toggle starts SpeechRecognition — headless
// chrome lacks it; instead dispatch a text turn which runs same TTS path.
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Say exactly: audio pipeline check one two three.' })));
// watch for speaking state + collect TTS network calls
const ttsCalls = [];
page.on('response', r => { if (r.url().includes('/api/ai/')) ttsCalls.push(`${r.status()} ${r.url()}`); });
await new Promise(r => setTimeout(r, 12000));
const state = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log('TTS/API calls:', ttsCalls.slice(0,8));
console.log('has SPEAKING or transcript:', /SPEAKING|audio pipeline/i.test(state));
console.log('PAGE ERRORS:', errors.length ? errors.slice(0,6) : 'none');
await browser.close();
