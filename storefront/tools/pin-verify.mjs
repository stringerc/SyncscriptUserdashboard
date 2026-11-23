import { chromium } from 'playwright-core';
import { resolveCdpUrl } from './cdp-url.mjs';
const browser = await chromium.connectOverCDP(await resolveCdpUrl());
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
for (const id of ['961870432944191822','961870432944190766']) {
  await page.goto(`https://www.pinterest.com/pin/${id}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  const d = await page.evaluate(() => ({
    video: !!document.querySelector('video'),
    desc: (document.querySelector('[data-test-id="pin-description"], .Zh1WH, [class*=description]')?.innerText||'').slice(0,140),
    link: (document.querySelector('a[href*="gumroad"]')?.href||'none').slice(0,80),
  }));
  console.log(id, JSON.stringify(d));
}
await browser.close();
