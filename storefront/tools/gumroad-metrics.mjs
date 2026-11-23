// gumroad-metrics.mjs — best-effort revenue scrape via the logged-in
// automation Chrome (CDP). Reads app.gumroad.com/dashboard and extracts
// balance / last-7d / last-28d / total earnings defensively. Also tries
// the Sales page for per-product rows. Prints JSON; never throws hard.
// Usage: node tools/gumroad-metrics.mjs
import { chromium } from 'playwright-core';
import { resolveCdpUrl } from './cdp-url.mjs';

const OUT = { ok: true, checkedAt: new Date().toISOString(), balance: null, last7d: null, last28d: null, totalEarnings: null, salesRows: [], note: '' };
const browser = await chromium.connectOverCDP(await resolveCdpUrl());
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

const money = (s) => { const m = String(s || '').match(/\$\s?([\d,]+(?:\.\d+)?)/); return m ? parseFloat(m[1].replace(/,/g, '')) : null; };

try {
  await page.goto('https://app.gumroad.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(5000);
  const dash = await page.evaluate(() => document.body.innerText);
  if (/sign in|log in/i.test(dash.slice(0, 400))) {
    OUT.ok = false; OUT.note = 'gumroad dashboard not logged in via automation Chrome';
  } else {
    // Metrics block: "Balance $X  Last 7 days $Y  Last 28 days $Z  Total earnings $W"
    const grabAfter = (label) => {
      const i = dash.indexOf(label);
      return i < 0 ? null : money(dash.slice(i, i + 200));
    };
    OUT.balance = grabAfter('Balance');
    OUT.last7d = grabAfter('Last 7 days');
    OUT.last28d = grabAfter('Last 28 days');
    OUT.totalEarnings = grabAfter('Total earnings');
    OUT.note = 'dashboard metrics scraped';

    // Sales page for per-product rows (best-effort).
    try {
      await page.goto('https://app.gumroad.com/sales', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(4000);
      const sales = await page.evaluate(() => document.body.innerText.slice(0, 8000));
      const lines = sales.split('\n').map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        if (/hook pack|listing kit|starter|engine|kit|system/i.test(lines[i]) && lines[i].length < 120) {
          const w = lines.slice(i, i + 8).join(' ');
          const qty = w.match(/(\d+)\s*(?:×|x|sold|sales|orders)/i);
          const rev = w.match(/\$\s?([\d,]+(?:\.\d+)?)/g);
          OUT.salesRows.push({ name: lines[i].slice(0, 100), qty: qty ? parseInt(qty[1], 10) : null, amounts: rev ? rev.slice(0, 3) : [] });
        }
      }
      OUT.note += `; sales page ${OUT.salesRows.length} rows`;
    } catch { OUT.note += '; sales page unreachable'; }
  }
} catch (e) {
  OUT.ok = false; OUT.note = String(e?.message || e).slice(0, 160);
}
await page.close().catch(() => {});
await browser.close().catch(() => {});
console.log(JSON.stringify(OUT));
