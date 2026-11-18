// Streamlined pin creation (post-onboarding). Args: img title desc link
import { chromium } from 'playwright-core';
import { cdpUrl } from './cdp-url.mjs';
const [img, title, desc, link] = process.argv.slice(2);
const browser = await chromium.connectOverCDP(cdpUrl());
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest.com')) || browser.contexts()[0].pages()[0];

// dismiss any leftover dialog
const closeBtn = page.locator('.layer_J button:has-text("See your Pin"), .layer_J [aria-label*=lose]').first();
if (await closeBtn.count()) await closeBtn.click().catch(()=>{});
await page.keyboard.press('Escape').catch(()=>{});

await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.locator('input[type=file]').first().setInputFiles(img);
await page.waitForTimeout(8000);
await page.locator('textarea[placeholder="Add your title"]').fill(title);
const ed = page.locator('[contenteditable=true]').first();
await ed.click();
await page.keyboard.type(desc, {delay: 3});
await page.locator('textarea[placeholder="Add a destination link"]').fill(link);
await page.waitForTimeout(800);
const pub = page.locator('[data-test-id="board-dropdown-save-button"]').first();
await pub.click({timeout: 15000});
await page.waitForTimeout(5000);
const toast = await page.evaluate(() => document.body.innerText.includes('You created a Pin') || document.body.innerText.includes('Saved to'));
console.log('PUBLISHED:', toast, '| url:', page.url());
await browser.close();
