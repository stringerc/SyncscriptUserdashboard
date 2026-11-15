import { chromium } from '/Users/Apple/.cursor/mcp-servers/google-flow-browser-mcp/node_modules/playwright-core/index.mjs';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest.com'));
for (let i=0;i<6;i++){
  const layer = page.locator('.layer_J').last();
  if (!(await layer.count())) break;
  const txt = await layer.innerText();
  console.log('dialog',i,':',txt.slice(0,80).replace(/\n/g,' | '));
  // try close/X first, else Next
  const close = layer.locator('button[aria-label*=lose],button[aria-label*=ismiss],[data-test-id*=close i]').first();
  const next = layer.locator('button:has-text("Next"),div[role=button]:has-text("Next")').first();
  if (await close.count()) { await close.click().catch(()=>{}); }
  else if (await next.count()) { await next.click().catch(()=>{}); }
  else { await page.keyboard.press('Escape'); }
  await page.waitForTimeout(1200);
}
console.log('done');
await browser.close();
