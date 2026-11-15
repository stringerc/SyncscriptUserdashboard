import { chromium } from '/Users/Apple/.cursor/mcp-servers/google-flow-browser-mcp/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'fs';
const [link, file] = process.argv.slice(2);
const text = readFileSync(file, 'utf8').trim();
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('reddit.com'));
if (!page.url().includes(link.split('/comments/')[1]?.split('/')[0] || '___')) {
  await page.goto('https://www.reddit.com' + link, {waitUntil:'domcontentloaded'});
}
await page.waitForTimeout(4000);
for(let i=0;i<3;i++){await page.mouse.wheel(0,2000);await page.waitForTimeout(1200);}
// click "Join the conversation" leaf element
const leaf = page.locator('text=Join the conversation').last();
await leaf.scrollIntoViewIfNeeded();
await leaf.click({timeout:8000});
await page.waitForTimeout(2000);
const ed = page.locator('[data-lexical-editor="true"][contenteditable="true"]').first();
await ed.click({timeout:8000});
await page.waitForTimeout(800);
await page.keyboard.type(text, {delay: 2});
await page.waitForTimeout(1200);
await page.locator('button:has-text("Comment")').last().click({timeout:8000});
await page.waitForTimeout(5000);
const ok = await page.evaluate(t => document.body.innerText.includes(t.slice(0,40)), text);
console.log('POSTED:', ok);
await browser.close();
