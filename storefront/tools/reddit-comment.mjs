// Post a comment on a Reddit thread via logged-in CDP Chrome.
// Usage: node reddit-comment.mjs <permalink> <comment-file>
import { chromium } from '/Users/Apple/.cursor/mcp-servers/google-flow-browser-mcp/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'fs';
const [link, file] = process.argv.slice(2);
const text = readFileSync(file, 'utf8').trim();
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('reddit.com'));
await page.goto('https://www.reddit.com' + link, {waitUntil:'domcontentloaded'});
await page.waitForTimeout(4000);
// find comment composer
const composer = page.locator('div[slot=text-area], [contenteditable=true][data-lexical-editor], textarea[placeholder*="Comment" i], shreddit-composer div[contenteditable=true]').first();
const count = await composer.count();
console.log('composer count:', count);
if (!count) {
  // fallback: dump candidate elements
  const cands = await page.evaluate(() => [...document.querySelectorAll('[contenteditable],textarea')].map(e=>({tag:e.tagName,ce:e.isContentEditable,ph:e.placeholder||'',aria:e.getAttribute('aria-label')||''})).slice(0,15));
  console.log(JSON.stringify(cands));
  await browser.close(); process.exit(1);
}
await composer.click();
await page.waitForTimeout(800);
await page.keyboard.type(text, {delay: 3});
await page.waitForTimeout(1000);
// find submit button
const submit = page.locator('button:has-text("Comment"), [data-testid*=comment-submit], button[type=submit]').last();
await submit.click();
await page.waitForTimeout(4000);
const posted = await page.evaluate(() => document.body.innerText.includes(text.slice(0,40)));
console.log('POSTED:', posted);
await browser.close();
