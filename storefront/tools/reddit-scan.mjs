import { chromium } from '/Users/Apple/.cursor/mcp-servers/google-flow-browser-mcp/node_modules/playwright-core/index.mjs';
const subs = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('reddit.com'));
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
