// gcal-create.mjs — create a Google Calendar event via the automation Chrome (CDP).
// Usage: node gcal-create.mjs "<title>" "<startISO>" "<endISO>" "[description]" [--allday]
// Dates: RFC3339 e.g. 2026-11-16T09:30:00-05:00. All-day uses YYYY-MM-DD.
import { chromium } from 'playwright-core';
import { resolveCdpUrl } from './cdp-url.mjs';
import fs from 'node:fs';
import path from 'node:path';


const args = process.argv.slice(2);
const allday = args.includes('--allday');
const [title, startISO, endISO, ...rest] = args.filter(a => a !== '--allday');
const desc = rest.join(' ');
if (!title || !startISO || !endISO) {
  console.log('USAGE: gcal-create.mjs "title" "startISO" "endISO" "[desc]" [--allday]');
  process.exit(2);
}

const fmt = (iso, alldayMode) => {
  if (alldayMode) return iso.slice(0, 10).replace(/-/g, '');
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
};

const params = new URLSearchParams({
  action: 'TEMPLATE',
  text: title,
  dates: `${fmt(startISO, allday)}/${fmt(endISO, allday)}`,
  details: desc || '',
});
if (allday) params.set('details', (desc || '') + '\n\n(all-day)');

const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
const browser = await chromium.connectOverCDP(await resolveCdpUrl());
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// The render page shows a pre-filled event form; the save button is labelled "Save".
const save = page.locator('button:has-text("Save"), [role="button"]:has-text("Save")').first();
const visible = await save.isVisible().catch(() => false);
if (!visible) {
  const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 300);
  console.log('SAVE_BUTTON_NOT_FOUND | url:', page.url(), '| text:', bodyText.replace(/\s+/g, ' '));
  await page.close();
  await browser.close();
  process.exit(1);
}
await save.click();
await page.waitForTimeout(4000);
const confirmed = await page.evaluate(() =>
  /event saved|saved|has been (added|saved)/i.test(document.body.innerText) ||
  location.href.includes('eventedit') === false
);
console.log('CALENDAR_EVENT:', confirmed ? 'CREATED' : 'UNCERTAIN', '| url:', page.url());
await page.close();
await browser.close();
