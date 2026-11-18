// browser-shot.mjs — capture the automation Chrome's active Reddit/Pinterest tab as PNG.
// Usage: node browser-shot.mjs [urlSubstring] [outPath]
// Defaults: prefer pinterest.com tab, else reddit.com, else first tab.
// Saves PNG + writes storefront/browser/latest.txt timestamp.
import { chromium } from 'playwright-core';
import { resolveCdpUrl } from './cdp-url.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [match = '', outArg] = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUTDIR = path.join(ROOT, 'browser');
fs.mkdirSync(OUTDIR, { recursive: true });
const out = outArg || path.join(OUTDIR, 'latest.png');


const browser = await chromium.connectOverCDP(await resolveCdpUrl());
const pages = browser.contexts()[0].pages();
let page = pages.find(p => p.url().includes(match))
  || pages.find(p => p.url().includes('pinterest.com'))
  || pages.find(p => p.url().includes('reddit.com'))
  || pages.find(p => p.url().includes('gumroad.com'))
  || pages[0];
if (!page) { console.log('NO_PAGE'); process.exit(1); }
await page.bringToFront().catch(() => {});
const buf = await page.screenshot({ type: 'png' });
fs.writeFileSync(out, buf);
fs.writeFileSync(path.join(OUTDIR, 'latest.txt'), `${Date.now()} ${page.url()}\n`);
console.log('SHOT:', out, '| url:', page.url(), '| bytes:', buf.length);
await browser.close();
