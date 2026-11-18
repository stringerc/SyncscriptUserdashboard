import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
function cdpUrl() {
  if (process.env.CORTEX_CDP_URL) return process.env.CORTEX_CDP_URL;
  try { const f = path.resolve('.cdp-url'); if (existsSync(f)) return readFileSync(f,'utf8').trim(); } catch {}
  return 'http://localhost:9225';
}
const subs = process.argv.slice(2);
const browser = await chromium.connectOverCDP(cdpUrl());
const ctx = browser.contexts()[0];
// No reddit tab? Reuse any open page as the vehicle — goto() navigates it
// anyway. Only open a new tab when the browser has zero pages (fresh VM
// Chrome sits on about:blank with one page, but be safe).
const page = ctx.pages().find(p => p.url().includes('reddit.com'))
  || ctx.pages()[0]
  || await ctx.newPage();
for (const sub of subs) {
  await page.goto(`https://www.reddit.com/r/${sub}/hot/`, {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3500);
  // scroll once for lazy load
  await page.mouse.wheel(0, 3000); await page.waitForTimeout(2000);
  const posts = await page.evaluate(() => [...document.querySelectorAll('shreddit-post')].slice(0,20).map(x => ({
    t: x.getAttribute('post-title'), c: x.getAttribute('comment-count'), u: x.getAttribute('author'), l: x.getAttribute('permalink')
  })));
  console.log(`=== r/${sub}`);
  for (const p of posts) console.log(`${p.c}c | ${p.t.slice(0,95)} | ${p.l}`);
}
await browser.close();
