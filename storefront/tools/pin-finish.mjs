import { chromium } from 'playwright-core';
const [desc] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://localhost:9225');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest.com'));
const ed = page.locator('[contenteditable=true]').first();
await ed.click();
await page.keyboard.type(desc, {delay: 5});
await page.waitForTimeout(800);
// dismiss any remaining dialog layer
const layer = page.locator('.layer_J [role=button], .layer_J button').last();
if (await layer.count()) { await layer.click().catch(()=>{}); await page.waitForTimeout(800); }
const pub = page.locator('[data-test-id="board-dropdown-save-button"]').first();
await pub.click({timeout: 15000});
console.log('publish clicked');
await page.waitForTimeout(6000);
console.log('url:', page.url());
const confirm = await page.evaluate(() => document.body.innerText.slice(0,300));
console.log(confirm);
await browser.close();
