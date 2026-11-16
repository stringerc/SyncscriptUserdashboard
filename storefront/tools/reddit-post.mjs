import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Reddit comment poster — drives the automation Chrome over CDP.
// Contract: prints `POSTED: true|false | reason | screenshot | url` on
// stdout; exit 0 only when the comment text is verified on the page.
// Screenshots land in storefront/browser/ (latest.png feeds
// /api/cortex/browser-shot.png so a human can eyeball the result).
//
// CDP endpoint resolution: $CORTEX_CDP_URL → storefront/.cdp-url →
// http://localhost:9222. Point it at a local logged-in Chrome to skip
// the Oracle browser entirely.

const [permalink, file] = process.argv.slice(2);
if (!permalink || !file) {
  console.log('POSTED: false | reason:missing-args | need permalink + draft file');
  process.exit(1);
}
const text = readFileSync(file, 'utf8').trim();
if (!text) {
  console.log('POSTED: false | reason:empty-draft');
  process.exit(1);
}

function cdpUrl() {
  if (process.env.CORTEX_CDP_URL) return process.env.CORTEX_CDP_URL;
  try {
    const f = path.resolve('.cdp-url');
    if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  } catch { }
  return 'http://localhost:9222';
}

const shotDir = path.resolve('browser');
mkdirSync(shotDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const shotLatest = path.join(shotDir, 'latest.png');
const shotStamp = path.join(shotDir, `reddit-${stamp}.png`);

let browser, page;
const snap = async (label) => {
  try {
    await page.screenshot({ path: shotLatest });
    copyFileSync(shotLatest, shotStamp);
    return shotStamp;
  } catch (e) { return `screenshot-failed:${e.message}`; }
};
const done = async (posted, reason) => {
  const shot = await snap(reason);
  console.log(`POSTED: ${posted} | reason: ${reason} | screenshot: ${shot} | url: ${page?.url?.() || 'n/a'}`);
  try { await browser?.close(); } catch { }
  process.exit(posted ? 0 : 1);
};

try {
  browser = await chromium.connectOverCDP(cdpUrl());
  const ctx = browser.contexts()[0];
  page = ctx.pages().find(p => p.url().includes('reddit.com')) || await ctx.newPage();

  await page.goto('https://old.reddit.com' + permalink, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // ── Login gate: no credentials here — fail fast and loud instead of
  // burning 30s on a selector that can never appear. ──
  const auth = await page.evaluate(() => ({
    userKarma: !!document.querySelector('.user .userkarma, .user a.author'),
    loginLink: !!document.querySelector('a[href*="login"], .user a[href*="register"]'),
    hasCommentBox: !!document.querySelector('textarea[name="text"], div[slot="comment"] [contenteditable="true"]'),
  }));
  if (!auth.userKarma && auth.loginLink) {
    await done(false, 'reddit-not-logged-in — sign into reddit in the automation Chrome once');
  }

  // ── old.reddit flow ──
  let ta = page.locator('textarea[name="text"]').first();
  if (await ta.count() === 0) {
    // Some threads hide the box behind a "join the conversation" toggle.
    const join = page.locator('text=/join the conversation|add a comment/i').first();
    if (await join.count()) { await join.click().catch(() => { }); await page.waitForTimeout(1500); }
    ta = page.locator('textarea[name="text"]').first();
  }
  if (await ta.count() === 0) {
    await done(false, 'comment-box-not-found — page may have changed or thread locked');
  }

  await ta.click();
  await ta.fill(text);
  await page.waitForTimeout(800);

  const saveBtn = page.locator('button.save, input[value="save"], button:has-text("save")').first();
  if (await saveBtn.count() === 0) {
    await done(false, 'save-button-not-found');
  }
  await saveBtn.click();
  await page.waitForTimeout(5000);

  // ── Verify: our text must appear on the rendered page ──
  const ok = await page.evaluate((t) => document.body.innerText.includes(t.slice(0, 40)), text);
  if (!ok) await done(false, 'comment-not-visible-after-submit — possible shadowban or rate limit');
  await done(true, 'verified-on-page');
} catch (e) {
  try {
    if (page) {
      const shot = await snap('crash');
      console.log(`POSTED: false | reason: crash: ${String(e.message).slice(0, 160)} | screenshot: ${shot} | url: ${page.url()}`);
    } else {
      console.log(`POSTED: false | reason: crash: ${String(e.message).slice(0, 160)} | screenshot: none | url: n/a`);
    }
  } catch { console.log(`POSTED: false | reason: crash: ${String(e.message).slice(0, 160)}`); }
  process.exit(1);
}
