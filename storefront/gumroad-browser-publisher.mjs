#!/usr/bin/env node
/**
 * Gumroad Browser Publisher — creates products via the web UI using stored
 * credentials. Used when no API access token is available.
 *
 * This is the path that actually worked before (2026-11-06 batch published
 * 10 products to syncmaster1.gumroad.com via Puppeteer).
 *
 * Usage:
 *   node gumroad-browser-publisher.mjs --dry-run     # show plan, launch nothing
 *   node gumroad-browser-publisher.mjs --now         # publish next pending product
 *   node gumroad-browser-publisher.mjs --batch 3     # publish up to N products now
 *
 * Env (from .env.local):
 *   GUMROAD_EMAIL, GUMROAD_PASSWORD
 *   GUMROAD_IMAGE_PATH   path to hero image (optional but STRONGLY recommended —
 *                        listings without images are why the last batch died)
 *   GUMROAD_FILE_PATH    path to product ZIP/PDF to attach (optional)
 *
 * IMPORTANT: headless:false — Gumroad's bot detection may challenge headless.
 * A browser window will appear; do not interact with it while it runs.
 */

import puppeteer from "puppeteer";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(ROOT, "products", "catalog-v2.json");
const STATE = join(ROOT, ".gumroad-state.json");
const ENV_PATH = join(ROOT, "..", ".env.local");

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(ENV_PATH, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return { ...env, ...process.env };
}

async function loadJSON(p, fb) { try { return JSON.parse(await readFile(p, "utf-8")); } catch { return fb; } }
async function saveJSON(p, d) { await writeFile(p, JSON.stringify(d, null, 2)); }

async function loadState() {
  const s = await loadJSON(STATE, { posted: {}, scheduled: {} });
  s.posted ??= {}; s.scheduled ??= {};
  return s;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Puppeteer has no :has-text() — find clickable elements by their label.
async function clickByText(page, texts) {
  return await page.evaluate((ts) => {
    const els = [...document.querySelectorAll('button, a, [role="button"], [role="radio"], label, summary')];
    for (const t of ts) {
      const el = els.find(e => (e.innerText || e.textContent || '').trim().toLowerCase().includes(t.toLowerCase()));
      if (el) { el.click(); return t; }
    }
    return null;
  }, texts);
}

async function login(page, email, password) {
  await page.goto("https://gumroad.com/login", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', { timeout: 20000 });
  const emailSel = await page.$('input[type="email"], input[name="email"]') ? 'input[type="email"], input[name="email"]' : 'input[placeholder*="email" i]';
  await page.type(emailSel, email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
  // Verify logged in — dashboard or products page, not login.
  const url = page.url();
  if (url.includes("/login")) throw new Error("Login failed — still on login page");
  console.log(`  logged in → ${url}`);
}

async function publishProduct(page, product, opts) {
  console.log(`\n📦 ${product.name} — $${product.price}`);

  // Gumroad product creation flow: /products/new → choose type → fill form.
  await page.goto("https://gumroad.com/products/new", { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);

  // Step 1: select "Digital product" — click whatever option mentions it.
  const clicked = await clickByText(page, ['digital product', 'digital download', 'e-book and other digital', 'digital']);
  if (!clicked) throw new Error("Could not find 'Digital product' option — Gumroad UI may have changed");
  console.log(`  selected: ${clicked}`);
  await sleep(1000);

  // Continue/Next button
  const nextClicked = await clickByText(page, ['continue', 'next', 'get started']);
  if (nextClicked) { console.log(`  step: ${nextClicked}`); await sleep(1500); }
  else {
    const submit = await page.$('button[type="submit"]');
    if (submit) { await submit.click(); await sleep(1500); }
  }

  // Step 2: fill name
  const nameInput = await page.$('input[name*="name" i], input[placeholder*="name" i], input[id*="name" i]');
  if (nameInput) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.type(product.name, { delay: 10 });
  }

  // Step 3: price — look for price input
  const priceInput = await page.$('input[name*="price" i], input[inputmode="decimal"], input[placeholder*="price" i]');
  if (priceInput) {
    await priceInput.click({ clickCount: 3 });
    await priceInput.type(String(product.price), { delay: 10 });
  }

  // Step 4: description (rich text or textarea)
  const descArea = await page.$('textarea[name*="description" i], [contenteditable="true"], textarea');
  if (descArea) {
    await descArea.click();
    // If contenteditable, use keyboard; if textarea, type
    const tag = await descArea.evaluate(el => el.tagName);
    if (tag === "TEXTAREA") {
      await descArea.type(product.description, { delay: 5 });
    } else {
      await page.keyboard.type(product.description, { delay: 5 });
    }
  }

  // Step 5: content file upload (ZIP/PDF)
  if (opts.filePath && existsSync(opts.filePath)) {
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(opts.filePath);
      console.log(`  📎 uploaded ${opts.filePath}`);
      await sleep(3000); // wait for upload
    }
  }

  // Step 6: image upload
  if (opts.imagePath && existsSync(opts.imagePath)) {
    const imgInput = await page.$('input[type="file"][accept*="image"], input[type="file"][accept*=".png"], input[type="file"][accept*=".jpg"]');
    if (imgInput) {
      await imgInput.uploadFile(opts.imagePath);
      console.log(`  🖼️ uploaded ${opts.imagePath}`);
      await sleep(2000);
    }
  }

  // Step 7: publish/save
  const pubClicked = await clickByText(page, ['publish', 'save', 'done', 'create product']);
  if (pubClicked) {
    console.log(`  publish: ${pubClicked}`);
    await sleep(3000);
  } else {
    const submit = await page.$('button[type="submit"]');
    if (submit) { await submit.click(); await sleep(3000); }
  }

  const finalUrl = page.url();
  const productId = finalUrl.match(/\/products\/([a-zA-Z0-9_-]+)/)?.[1] || finalUrl.match(/\/l\/([a-zA-Z0-9_-]+)/)?.[1];
  return { ok: true, url: finalUrl, id: productId };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const catalog = await loadJSON(CATALOG);
  const state = await loadState();
  const env = loadEnv();

  const batchArg = process.argv.find(a => a.startsWith("--batch"));
  const batchSize = batchArg ? parseInt(batchArg.split("=")[1] || process.argv[process.argv.indexOf("--batch") + 1] || "1") : 1;

  const slugArg = process.argv.find(a => a.startsWith("--slug="))?.split("=")[1];
  const fileArg = process.argv.find(a => a.startsWith("--file="))?.split("=")[1];
  const imageArg = process.argv.find(a => a.startsWith("--image="))?.split("=")[1];

  let pending = catalog.products.filter(p => !state.posted[p.slug]);
  if (slugArg) pending = pending.filter(p => p.slug === slugArg);
  const toPost = pending.slice(0, batchSize || 1);
  const filePath = fileArg || env.GUMROAD_FILE_PATH;
  const imagePath = imageArg || env.GUMROAD_IMAGE_PATH;

  if (!toPost.length) { console.log("Nothing pending."); return; }

  if (args.has("--dry-run")) {
    console.log(`Would publish ${toPost.length} product(s):`);
    for (const p of toPost) console.log(`  ${p.name} — $${p.price} (${p.slug})`);
    console.log(`\nImage: ${env.GUMROAD_IMAGE_PATH || "(none set)"}`);
    console.log(`File:   ${env.GUMROAD_FILE_PATH || "(none set)"}`);
    return;
  }

  if (!env.GUMROAD_EMAIL || !env.GUMROAD_PASSWORD) {
    console.error("GUMROAD_EMAIL / GUMROAD_PASSWORD not set in .env.local");
    process.exit(1);
  }

  console.log(`Launching browser — ${toPost.length} product(s) queued`);
  const browser = await puppeteer.launch({
    headless: false, // Gumroad bot detection challenges headless
    slowMo: 80,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    if (args.has("--manual-login")) {
      // Open login page and wait for the user to complete sign-in + 2FA
      // in the visible browser window (up to 5 minutes).
      console.log("Browser open — please sign in and complete 2FA. Waiting for dashboard...");
      await page.goto("https://gumroad.com/login", { waitUntil: "networkidle2", timeout: 60000 });
      const deadline = Date.now() + 5 * 60_000;
      while (Date.now() < deadline) {
        const u = page.url();
        // Only accept gumroad.com dashboard/products — OAuth detours through
        // accounts.google.com must not count as "logged in".
        if (u.startsWith("https://gumroad.com/") &&
            !u.includes("/login") && !u.includes("/two-factor") && !u.includes("/signup") &&
            !u.includes("/users/auth")) break;
        await sleep(2000);
      }
      const finalU = page.url();
      if (!finalU.startsWith("https://gumroad.com/") || finalU.includes("/login") || finalU.includes("/two-factor"))
        throw new Error(`Timed out waiting for login — stuck at ${finalU.slice(0, 80)}`);
      console.log(`  login complete → ${page.url()}`);
    } else {
      await login(page, env.GUMROAD_EMAIL, env.GUMROAD_PASSWORD);
    }

    for (const product of toPost) {
      try {
        const result = await publishProduct(page, product, {
          imagePath,
          filePath,
        });
        if (result.ok) {
          state.posted[product.slug] = { url: result.url, id: result.id, at: new Date().toISOString(), method: "browser" };
          await saveJSON(STATE, state);
          console.log(`  ✅ ${result.url}`);
        }
      } catch (e) {
        console.error(`  ❌ ${product.slug}: ${e.message}`);
        // Continue to next product rather than aborting the batch.
      }
      await sleep(5000); // polite delay between products
    }
  } finally {
    await browser.close();
  }

  const posted = Object.keys(state.posted).length;
  console.log(`\nDone. Posted: ${posted}/${catalog.products.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
