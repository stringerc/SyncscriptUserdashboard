import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('reddit.com'));
const info = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role=button], faceplate-tracker, shreddit-async-loader')].map(e => ({
    tag: e.tagName, text: (e.innerText||'').slice(0,60), aria: e.getAttribute('aria-label')||'', testid: e.getAttribute('data-testid')||''
  })).filter(x => /comment|conversation|join/i.test(x.text + x.aria + x.testid));
  const editors = [...document.querySelectorAll('[data-lexical-editor]')].map(e => ({visible: !!(e.offsetWidth||e.offsetHeight), ph: e.getAttribute('aria-placeholder')}));
  return {cands: cands.slice(0,15), editors};
});
console.log(JSON.stringify(info,null,1).slice(0,4000));
await browser.close();
