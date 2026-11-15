import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/cortex/visualizer', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'Reply with one short sentence about the ocean.' })));
// poll during playback: count <audio> elements (gapless path uses none) + speaking state
let sawSpeaking = false, maxAudioEls = 0;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 500));
  const st = await page.evaluate(() => ({
    audio: document.querySelectorAll('audio').length,
    speaking: document.body.innerText.includes('SPEAKING'),
  }));
  if (st.speaking) sawSpeaking = true;
  maxAudioEls = Math.max(maxAudioEls, st.audio);
  if (sawSpeaking && !st.speaking && i > 4) break;
}
console.log('saw SPEAKING state:', sawSpeaking, '| <audio> elements seen:', maxAudioEls, '(0 = gapless WebAudio path)');
console.log('PAGE ERRORS:', errors.length ? errors : 'none');
await browser.close();
