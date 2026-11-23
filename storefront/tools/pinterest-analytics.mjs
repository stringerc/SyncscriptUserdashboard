// pinterest-analytics.mjs — scrape per-pin analytics via the logged-in
// automation Chrome (CDP). Reads storefront/campaigns.json, visits each
// verified Pinterest pin's /analytics page, extracts impressions/clicks/
// saves defensively, prints JSON to stdout.
// Usage: node tools/pinterest-analytics.mjs
import { chromium } from 'playwright-core';
import { resolveCdpUrl } from './cdp-url.mjs';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(path.join(ROOT, 'campaigns.json'), 'utf8'));
const queue = JSON.parse(readFileSync(path.join(ROOT, 'distribution-queue.json'), 'utf8'));

const pinIds = new Set();
const collect = (u) => {
  const m = String(u || '').match(/pinterest\.com\/pin\/(\d+)/);
  if (m) pinIds.add(m[1]);
};
for (const c of registry.campaigns || []) {
  for (const u of c.verifiedUrls || []) collect(u);
  for (const pid of c.pinIds || []) pinIds.add(String(pid));
}
// Queue item results carry the verified pin URLs (same source as the API).
for (const i of queue.items || []) {
  const r = i.result;
  if (!r || typeof r !== 'object') continue;
  if (Array.isArray(r.pins)) r.pins.forEach(collect);
  else collect(r.url);
}
if (!pinIds.size) { console.log(JSON.stringify({ ok: true, pins: [], note: 'no pinterest pins in campaigns.json' })); process.exit(0); }

const browser = await chromium.connectOverCDP(await resolveCdpUrl());
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
const pins = [];

// Pinterest analytics cards render label + big number; grab all
// "Label ... number" pairs defensively.
const extract = () => page.evaluate(() => {
  const text = document.body.innerText || '';
  const grab = (labels) => {
    for (const l of labels) {
      const re = new RegExp(`${l}[^0-9]{0,40}([0-9][0-9,]*)`, 'i');
      const m = text.match(re);
      if (m) return parseInt(m[1].replace(/,/g, ''), 10);
    }
    return null;
  };
  return {
    title: document.title.slice(0, 120),
    impressions: grab(['impressions', 'views']),
    clicks: grab(['clicks', 'link clicks', 'outbound']),
    saves: grab(['saves', 'repins']),
    engagements: grab(['engagements', 'total engagements']),
  };
});

for (const id of pinIds) {
  const rec = { pinId: id, url: `https://www.pinterest.com/pin/${id}/analytics` };
  try {
    await page.goto(rec.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4500);
    // Pinterest's SPA sometimes serves an un-hydrated shell — if nothing
    // parsed, reload once and retry before declaring the metrics unknown.
    let data = await extract();
    if (data.impressions == null && data.clicks == null && data.saves == null) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(6000);
      data = await extract();
    }
    Object.assign(rec, data, { ok: true });
  } catch (e) {
    rec.ok = false; rec.error = String(e?.message || e).slice(0, 160);
  }
  pins.push(rec);
}
await page.close().catch(() => {});
await browser.close().catch(() => {});
console.log(JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), pins }));
