import { chromium } from 'playwright-core';
import { resolveExtensionCdpUrl, recordVerifiedBackend } from './cdp-url.mjs';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Reddit comment poster — drives a Chrome over CDP (default the local
// logged-in automation profile; override with $CORTEX_CDP_URL or
// storefront/.cdp-url). Uses www.reddit.com: old.reddit.com thread pages
// redirect logged-in sessions to /login?reason=lor2 and datacenter IPs
// are network-policy blocked outright.
//
// Contract: prints `POSTED: true|false | reason | screenshot | url`.
// Exit 0 only when the comment text is verified on the rendered page.
// Screenshots land in storefront/browser/ (latest.png feeds
// /api/cortex/browser-shot.png so a human can eyeball the result).

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


const shotDir = path.resolve('browser');
mkdirSync(shotDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const shotLatest = path.join(shotDir, 'latest.png');
const shotStamp = path.join(shotDir, `reddit-${stamp}.png`);

let browser, page;
const snap = async () => {
  try {
    await page.screenshot({ path: shotLatest });
    copyFileSync(shotLatest, shotStamp);
    return shotStamp;
  } catch (e) { return `screenshot-failed:${e.message}`; }
};
const done = async (posted, reason) => {
  const shot = await snap();
  console.log(`POSTED: ${posted} | reason: ${reason} | screenshot: ${shot} | url: ${page?.url?.() || 'n/a'}`);
  if (posted) recordVerifiedBackend('reddit_post', 'openclaw-extension-relay');
  try { await browser?.close(); } catch { }
  process.exit(posted ? 0 : 1);
};

try {
  browser = await chromium.connectOverCDP(await resolveExtensionCdpUrl());
  const ctx = browser.contexts()[0];
  page = ctx.pages().find(p => p.url().includes('reddit.com')) || await ctx.newPage();

  const threadUrl = 'https://www.reddit.com' + permalink.replace(/\/+$/, '') + '/';
  await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  if (page.url().includes('/login')) {
    await done(false, 'reddit-not-logged-in — sign into reddit in the automation Chrome once');
  }

  // ── Locked threads can't be commented on. The "Locked post" svg
  // aria-label appears on normal posts too — only visible body text
  // is a reliable signal. ──
  const locked = await page.evaluate(() =>
    /comments are locked|this post is locked|posting has been disabled/i.test(document.body.innerText.slice(0, 5000)));
  if (locked) await done(false, 'thread-locked — comments disabled on this post');

  // ── New-reddit flow: the composer starts as a collapsed
  // faceplate-textarea-input bar; clicking it expands the lexical
  // editor. Fallbacks: "Join the conversation" text, then any
  // already-visible editor. ──
  const collapsedInput = page.locator('comment-composer-host faceplate-textarea-input, shreddit-composer-host faceplate-textarea-input').first();
  if (await collapsedInput.count()) {
    await collapsedInput.scrollIntoViewIfNeeded().catch(() => { });
    await collapsedInput.click({ timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(2500);
  }
  if (await page.locator('[data-lexical-editor="true"][contenteditable="true"]:visible').count() === 0) {
    const joinBtn = page.locator('text=Join the conversation').last();
    if (await joinBtn.count()) {
      await joinBtn.scrollIntoViewIfNeeded().catch(() => { });
      await joinBtn.click({ timeout: 8000 }).catch(() => { });
      await page.waitForTimeout(2500);
    }
  }

  // Comment editor: lexical contenteditable inside the composer. Threads
  // render several editors (main box + hidden reply templates) — the
  // visible one is the live composer.
  const editors = page.locator('[data-lexical-editor="true"][contenteditable="true"]:visible, shreddit-composer [contenteditable="true"]:visible');
  const edCount = await editors.count();
  if (edCount === 0) {
    await done(false, 'comment-box-not-found — composer never opened (locked thread or UI change)');
  }
  const editor = editors.nth(edCount - 1); // last visible editor = main composer (reply templates sit earlier in DOM)
  await editor.scrollIntoViewIfNeeded().catch(() => { });
  await editor.click({ timeout: 8000 });
  await page.waitForTimeout(600);
  await page.keyboard.type(text, { delay: 2 });
  await page.waitForTimeout(1200);

  const commentBtn = page.locator('comment-composer-host button:has-text("Comment"), shreddit-composer button:has-text("Comment")').last();
  if (await commentBtn.count() === 0) {
    await done(false, 'comment-button-not-found');
  }
  await commentBtn.click({ timeout: 8000 });
  await page.waitForTimeout(6000);

  // ── Verify: our text must appear on the rendered page ──
  const ok = await page.evaluate((t) => document.body.innerText.includes(t.slice(0, 40)), text);
  if (!ok) await done(false, 'comment-not-visible-after-submit — possible shadowban, rate limit, or removed');
  await done(true, 'verified-on-page');
} catch (e) {
  try {
    if (page) {
      const shot = await snap();
      console.log(`POSTED: false | reason: crash: ${String(e.message).slice(0, 160)} | screenshot: ${shot} | url: ${page.url()}`);
    } else {
      console.log(`POSTED: false | reason: crash: ${String(e.message).slice(0, 160)} | screenshot: none | url: n/a`);
    }
  } catch { console.log(`POSTED: false | reason: crash: ${String(e.message).slice(0, 160)}`); }
  process.exit(1);
}
