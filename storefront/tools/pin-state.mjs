import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest.com'));
const dialogs = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],.layer_J,[class*=modal],[class*=Modal]')].map(d => ({
  cls: (d.className||'').slice(0,80), text: (d.innerText||'').slice(0,400)
})).filter(d=>d.text));
console.log(JSON.stringify(dialogs,null,1).slice(0,4000));
await page.screenshot({path:'/tmp/pin-state.png'});
await browser.close();
