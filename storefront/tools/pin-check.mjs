import { chromium } from 'playwright-core';
import { cdpUrl } from './cdp-url.mjs';
const browser = await chromium.connectOverCDP(cdpUrl());
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
