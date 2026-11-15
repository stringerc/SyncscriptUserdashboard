#!/usr/bin/env node
/**
 * Generate product hero images via Google Gemini image API (Nano Banana).
 * Usage: GEMINI_API_KEY=... node gemini-image-gen.mjs
 * Reads prompts from products/catalog-v2.json heroPrompt fields for top 3.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(ROOT, "products", "catalog-v2.json");
const OUT = join(ROOT, "assets");
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL = "gemini-2.5-flash-image";

const TOP3 = ["agentic-coding-starter-system", "ai-voice-agent-starter-kit", "real-estate-ai-listing-kit"];

async function generate(prompt, aspectRatio = "4:3") {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    },
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  for (const cand of json.candidates ?? []) {
    for (const part of cand.content?.parts ?? []) {
      if (part.inlineData?.data) return Buffer.from(part.inlineData.data, "base64");
    }
  }
  throw new Error("No image data in response: " + JSON.stringify(json).slice(0, 300));
}

async function main() {
  if (!KEY) { console.error("Set GEMINI_API_KEY"); process.exit(1); }
  await mkdir(OUT, { recursive: true });
  const catalog = JSON.parse(await readFile(CATALOG, "utf-8"));

  for (const slug of TOP3) {
    const product = catalog.products.find(p => p.slug === slug);
    if (!product?.heroPrompt) { console.log(`skip ${slug} — no heroPrompt`); continue; }
    console.log(`generating ${slug}...`);
    try {
      const buf = await generate(product.heroPrompt);
      const file = join(OUT, `${slug}.png`);
      await writeFile(file, buf);
      console.log(`  ✅ ${file} (${(buf.length / 1024).toFixed(0)}KB)`);
    } catch (e) {
      console.log(`  ❌ ${slug}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
