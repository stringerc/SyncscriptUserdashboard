import { chromium } from 'playwright-core';
import { resolveCdpUrl } from './cdp-url.mjs';
const subs = process.argv.slice(2);
const browser = await chromium.connectOverCDP(await resolveCdpUrl());
const ctx = browser.contexts()[0];
// No reddit tab? Reuse any open page as the vehicle — goto() navigates it
// anyway. Only open a new tab when the browser has zero pages (fresh VM
// Chrome sits on about:blank with one page, but be safe).
const page = ctx.pages().find(p => p.url().includes('reddit.com'))
  || ctx.pages()[0]
  || await ctx.newPage();
let blockReported = false;
for (const sub of subs) {
  await page.goto(`https://www.reddit.com/r/${sub}/hot/`, {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3500);
  // Reddit network-security block / login wall — detect once and report a
  // precise diagnostic instead of silently scraping zero posts. The
  // handler turns this marker into a dependency-class failure.
  if (!blockReported) {
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    if (/blocked by network security|file a ticket|you.?ve been blocked/i.test(bodyText)) {
      console.error('REDDIT_BLOCKED: reddit network-security block on this IP — log in to reddit in the automation Chrome or use a developer token');
      process.exit(2);
    }
    blockReported = true;
  }
  // scroll once for lazy load
  await page.mouse.wheel(0, 3000); await page.waitForTimeout(2000);
  const posts = await page.evaluate(() => [...document.querySelectorAll('shreddit-post')].slice(0,20).map(x => ({
    t: x.getAttribute('post-title'), c: x.getAttribute('comment-count'), u: x.getAttribute('author'), l: x.getAttribute('permalink')
  })));
  console.log(`=== r/${sub}`);
  for (const p of posts) console.log(`${p.c}c | ${p.t.slice(0,95)} | ${p.l}`);
}
await browser.close();
