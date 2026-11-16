import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest.com'));
const state = await page.evaluate(() => ({
  url: location.href,
  title: document.querySelector('textarea[placeholder="Add your title"]')?.value || '',
  link: document.querySelector('textarea[placeholder="Add a destination link"]')?.value || '',
  desc: document.querySelector('[contenteditable=true]')?.innerText?.slice(0,100) || '',
  dialogs: document.querySelectorAll('.layer_J').length
}));
console.log(JSON.stringify(state));
await browser.close();
