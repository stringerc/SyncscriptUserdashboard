// Minimal CDP driver over the user's real Chrome (port 9225).
// Usage: node cdp.mjs '<js expression>' [url-to-navigate-first]
//        node cdp.mjs --list
import { chromium } from 'playwright-core';
import { cdpUrl } from './cdp-url.mjs';
import fs from 'node:fs';
import path from 'node:path';


const args = process.argv.slice(2);
const browser = await chromium.connectOverCDP(cdpUrl());
const ctx = browser.contexts()[0];
const pages = ctx.pages();

if (args[0] === '--list') {
  for (const p of pages) console.log(p.url());
  await browser.close();
  process.exit(0);
}

// Find or create a working tab
let page = pages.find(p => !p.url().startsWith('chrome')) || pages[0];
if (args[1]) { await page.goto(args[1], { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000); }
const expr = args[0];
const result = await page.evaluate(expr).catch(e => 'EVAL_ERROR: ' + e.message);
console.log(JSON.stringify(result)?.slice(0, 4000) ?? result);
await browser.close();
