import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest.com'));
const btns = await page.evaluate(() => [...document.querySelectorAll('button,[role=button],[role=combobox],[role=listbox]')].map(b => ({
  text: (b.innerText||'').slice(0,60), aria: b.getAttribute('aria-label')||'', testid: b.getAttribute('data-test-id')||''
})).filter(b => b.text || b.aria || b.testid));
console.log(JSON.stringify(btns, null, 0).slice(0, 5000));
await browser.close();
