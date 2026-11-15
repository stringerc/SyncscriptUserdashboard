#!/usr/bin/env node
/**
 * Gumroad Catalog Scheduler v2
 *
 * Replaces the failed "10/day blind upload" approach. Reads catalog-v2.json,
 * picks products not yet posted, and schedules them across buyer-peak windows
 * (weekday 9:30a/1:30p/7:30p ET, weekend 10a/4p ET) instead of dumping daily.
 *
 * Modes:
 *   node gumroad-scheduler.mjs --dry-run            # show today's plan, post nothing
 *   node gumroad-scheduler.mjs --now                # post the next due product immediately (API mode)
 *   node gumroad-scheduler.mjs --daemon             # loop forever, firing at window times
 *   node gumroad-scheduler.mjs --status             # show posted/pending state
 *
 * Env:
 *   GUMROAD_ACCESS_TOKEN   Gumroad API access token (Settings → Advanced)
 *   GUMROAD_API            set to "1" to actually POST; otherwise dry-run only
 *   GUMROAD_DELIVERY_BASE  public base URL where product ZIPs/PDFs are hosted
 *                          (e.g. https://pub-xxx.r2.dev). Used as the product URL.
 *
 * State: storefront/.gumroad-state.json (posted slugs, timestamps, URLs)
 * Log:   storefront/GUMROAD_LAUNCH_LOG.md
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(ROOT, "products", "catalog-v2.json");
const STATE = join(ROOT, ".gumroad-state.json");
const LOG = join(ROOT, "GUMROAD_LAUNCH_LOG.md");

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

async function loadJSON(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf-8")); }
  catch { return fallback; }
}

async function saveJSON(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2));
}

async function loadState() {
  const s = await loadJSON(STATE, { posted: {}, scheduled: {} });
  s.posted ??= {}; s.scheduled ??= {};
  return s;
}

function etParts(date = new Date()) {
  // America/New_York via Intl — handles DST correctly.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    day: DAY_NAMES[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(parts.weekday)] ?? "mon",
    hhmm: `${parts.hour}:${parts.minute}`,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Next posting slot at/after `from` (Date), honoring catalog windows. */
function nextSlot(from, windows) {
  const cursor = new Date(from.getTime() + 60_000);
  for (let i = 0; i < 14; i++) {
    const d = new Date(cursor.getTime() + i * 24 * 60 * 60_000);
    const et = etParts(d);
    const win = windows.find(w => w.days.includes(et.day));
    if (!win) continue;
    for (const t of win.times) {
      const [h, m] = t.split(":").map(Number);
      // Build a Date in ET for that wall time, then check it's in the future in ET terms.
      const candidate = etWallTimeToDate(et.dateKey, h, m);
      if (candidate.getTime() > from.getTime()) return candidate;
    }
  }
  return null;
}

/** Convert an ET wall-clock time on a given ET date to a real Date. */
function etWallTimeToDate(dateKey, hour, minute) {
  // Iterate: guess UTC = ET+5 (EST) or +4 (EDT), then correct using Intl round-trip.
  const guess = new Date(`${dateKey}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00-05:00`);
  // Determine actual offset for that date.
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" });
  // Simpler: binary-search the UTC instant whose ET rendering matches.
  let lo = guess.getTime() - 3 * 3600_000, hi = guess.getTime() + 3 * 3600_000;
  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const et = etParts(new Date(mid));
    const etMin = Number(et.hhmm.slice(0,2)) * 60 + Number(et.hhmm.slice(3));
    const target = hour * 60 + minute;
    if (etMin < target) lo = mid; else hi = mid;
  }
  return new Date(hi);
}

async function postProduct(product, token, deliveryBase) {
  if (!token || !deliveryBase) {
    return { ok: false, reason: "GUMROAD_ACCESS_TOKEN or GUMROAD_DELIVERY_BASE missing" };
  }
  const url = `${deliveryBase.replace(/\/$/,"")}/${product.slug}.zip`;
  const body = new URLSearchParams({
    access_token: token,
    name: product.name,
    price: String(product.price),
    description: product.description,
    url,
    tags: (product.tags || []).join(","),
  });
  const res = await fetch("https://api.gumroad.com/v2/products", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    return { ok: false, reason: json.message || `HTTP ${res.status}` };
  }
  return { ok: true, id: json.product?.id, url: `https://${(product.tags||[])[0] ? "" : ""}gumroad.com/l/${product.slug}` };
}

async function logLine(text) {
  const stamp = new Date().toISOString();
  await writeFile(LOG, `${await readFile(LOG, "utf-8").catch(() => "# Gumroad Launch Log\n\n")}- ${stamp} | ${text}\n`, { flag: "a" });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const catalog = await loadJSON(CATALOG);
  const state = await loadState();
  const windows = catalog.postingWindows.windows;

  if (args.has("--status")) {
    const pending = catalog.products.filter(p => !state.posted[p.slug]);
    console.log(`Posted: ${Object.keys(state.posted).length} | Pending: ${pending.length}`);
    for (const p of pending.slice(0, 5)) console.log(`  next: ${p.slug} ($${p.price})`);
    return;
  }

  const now = new Date();
  const et = etParts(now);
  const slot = nextSlot(now, windows);

  if (args.has("--dry-run") || (!args.has("--now") && !args.has("--daemon"))) {
    const pending = catalog.products.filter(p => !state.posted[p.slug]);
    console.log(`Now (ET): ${et.day} ${et.hhmm}`);
    console.log(`Next slot: ${slot?.toISOString() ?? "none"}`);
    console.log(`Pending products: ${pending.length}`);
    for (const p of pending.slice(0, 3)) console.log(`  would post: ${p.name} — $${p.price}`);
    console.log("\nRun with --daemon to schedule, or --now + GUMROAD_API=1 to post.");
    return;
  }

  if (args.has("--now")) {
    const pending = catalog.products.filter(p => !state.posted[p.slug]);
    if (!pending.length) { console.log("Nothing pending."); return; }
    const p = pending[0];
    const token = process.env.GUMROAD_ACCESS_TOKEN;
    const deliveryBase = process.env.GUMROAD_DELIVERY_BASE;
    if (process.env.GUMROAD_API !== "1") {
      console.log(`[dry] would POST: ${p.name} — $${p.price} → ${deliveryBase}/${p.slug}.zip`);
      console.log("Set GUMROAD_API=1 to actually publish.");
      return;
    }
    const result = await postProduct(p, token, deliveryBase);
    if (result.ok) {
      state.posted[p.slug] = { id: result.id, at: new Date().toISOString(), url: result.url };
      await saveJSON(STATE, state);
      await logLine(`PUBLISHED | ${p.slug} | $${p.price} | ${result.url}`);
      console.log(`Published: ${p.name} → ${result.url}`);
    } else {
      await logLine(`FAILED | ${p.slug} | ${result.reason}`);
      console.error(`Failed: ${result.reason}`);
      process.exitCode = 1;
    }
    return;
  }

  if (args.has("--daemon")) {
    console.log(`Scheduler daemon running. Next slot: ${slot?.toISOString()}`);
    for (;;) {
      const s = await loadState();
      const pend = catalog.products.filter(p => !s.posted[p.slug]);
      if (!pend.length) { console.log("Catalog fully posted. Exiting."); break; }
      const target = nextSlot(new Date(), windows);
      if (!target) { console.log("No future slots found."); break; }
      const waitMs = target.getTime() - Date.now();
      console.log(`Sleeping ${Math.round(waitMs/60000)}min until ${target.toISOString()} (ET ${etParts(target).day} ${etParts(target).hhmm})`);
      await new Promise(r => setTimeout(r, waitMs));
      // Re-check state in case of manual posts.
      const s2 = await loadState();
      const p = catalog.products.find(x => !s2.posted[x.slug]);
      if (!p) continue;
      if (process.env.GUMROAD_API === "1") {
        const result = await postProduct(p, process.env.GUMROAD_ACCESS_TOKEN, process.env.GUMROAD_DELIVERY_BASE);
        if (result.ok) {
          s2.posted[p.slug] = { id: result.id, at: new Date().toISOString(), url: result.url };
          await saveJSON(STATE, s2);
          await logLine(`PUBLISHED | ${p.slug} | $${p.price} | ${result.url}`);
          console.log(`Published ${p.slug}`);
        } else {
          await logLine(`FAILED | ${p.slug} | ${result.reason}`);
          console.error(`Failed ${p.slug}: ${result.reason}`);
        }
      } else {
        console.log(`[dry] slot reached — would post: ${p.name} ($${p.price}). Set GUMROAD_API=1 to publish.`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
