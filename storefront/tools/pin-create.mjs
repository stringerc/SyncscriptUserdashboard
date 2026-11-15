// Full pin creation: upload image, fill fields, publish to selected board.
import { chromium } from '/Users/Apple/.cursor/mcp-servers/google-flow-browser-mcp/node_modules/playwright-core/index.mjs';

const [img, title, desc, link] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('pinterest.com')) || ctx.pages()[0];

await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.locator('input[type=file]').first().setInputFiles(img);
await page.waitForTimeout(8000);

await page.locator('textarea[placeholder="Add your title"]').fill(title);
await page.locator('[contenteditable=true][aria-label*="what your Pin"]').fill(desc);
await page.locator('textarea[placeholder="Add a destination link"]').fill(link);
await page.waitForTimeout(1000);

// Try Publish; if a Next step intervenes, click it first
const pub = page.locator('[data-test-id="board-dropdown-save-button"]');
if (await pub.count()) {
  await pub.click();
  console.log('clicked Publish');
} else {
  const next = page.locator('[data-test-id="board-dropdown-save-button"], button:has-text("Next")').first();
  await next.click();
  await page.waitForTimeout(2000);
  const pub2 = page.locator('[data-test-id="board-dropdown-save-button"], button:has-text("Publish")').first();
  await pub2.click();
  console.log('clicked via Next');
}
await page.waitForTimeout(5000);
console.log('final url:', page.url());
console.log('title:', await page.title());
await browser.close();
