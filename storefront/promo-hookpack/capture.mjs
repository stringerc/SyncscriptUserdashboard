import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/Users/Apple/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await page.goto('https://syncmaster1.gumroad.com/l/sbiozo', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'public/textures/gumroad-product.png' });
await page.screenshot({ path: 'public/textures/gumroad-product-full.png', fullPage: true });
console.log('captured', await page.title());
await browser.close();
