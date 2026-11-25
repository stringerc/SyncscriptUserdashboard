import { chromium } from 'playwright-core';
import { resolveExtensionCdpUrl } from './cdp-url.mjs';
import { readFileSync } from 'fs';
const [link, file] = process.argv.slice(2);
const text = readFileSync(file, 'utf8').trim();
const browser = await chromium.connectOverCDP(await resolveExtensionCdpUrl());
const page = browser.contexts()[0].pages().find(p => p.url().includes('reddit.com'));
await page.goto('https://www.reddit.com' + link, {waitUntil:'domcontentloaded'});
await page.waitForTimeout(4000);
// scroll to comments
await page.evaluate(() => { const c = document.querySelector('shreddit-comments, faceplate-partial[loading], [id*=comment]'); c?.scrollIntoView(); window.scrollTo(0, document.body.scrollHeight*0.5); });
await page.waitForTimeout(2000);
// click the join-the-conversation prompt if present
const prompt = page.locator('text=Join the conversation').first();
if (await prompt.count()) { await prompt.click().catch(()=>{}); await page.waitForTimeout(1500); }
const ed = page.locator('[data-lexical-editor="true"][contenteditable="true"]').first();
await ed.scrollIntoViewIfNeeded();
await ed.click({timeout:10000});
await page.waitForTimeout(800);
await page.keyboard.type(text, {delay: 2});
await page.waitForTimeout(1200);
const btn = page.locator('button:has-text("Comment")').last();
await btn.click({timeout:10000});
await page.waitForTimeout(5000);
const ok = await page.evaluate(t => document.body.innerText.includes(t.slice(0,40)), text);
console.log('POSTED:', ok);
await browser.close();
