#!/usr/bin/env node
/**
 * verify-memory-claims — treat MEMORY.md as testable, not as prose.
 *
 * Why this exists (2026-08-04):
 *   MEMORY.md is the curated operator handoff. Nothing verified it, so it rotted
 *   silently in two directions at once:
 *     * 52 of 59 documented `npm run` commands did not exist, because commit
 *       8fc667e ("Added all files in the current directory and subdirectories")
 *       cut package.json from 237 scripts to 26 and took the release gates with it.
 *       MEMORY was factually right; the toolchain had regressed underneath it.
 *     * File paths cited in backticks drifted as code moved.
 *   A memory file that confidently gives dead commands is worse than no memory,
 *   because an agent will run them and report a false failure cause.
 *
 * Checks (FAIL blocks, WARN informs):
 *   FAIL  every `npm run X` cited in docs is defined in package.json
 *   FAIL  every concrete repo-relative path cited in backticks exists
 *   FAIL  exactly one H1 per doc
 *   FAIL  no secret-shaped literals committed
 *   WARN  canonical-port drift (stray ports not marked superseded)
 *   WARN  retrieval budget: file size, over-long lines, bold saturation
 *
 * Usage:
 *   node scripts/verify-memory-claims.mjs
 *   node scripts/verify-memory-claims.mjs --strict   # WARN also fails
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const STRICT = process.argv.includes('--strict');
const DOCS = ['MEMORY.md', 'SESSION_START.md'];
const CANONICAL_PROXY_PORT = '8082';

// Retrieval budgets. MEMORY is read on demand by agents with finite context;
// these are the thresholds past which it stops being cheap to consult.
const BUDGET = { bytes: 260_000, maxLineChars: 900, boldRatioPct: 14 };

let fails = 0;
let warns = 0;
const fail = (m) => { console.log(`FAIL: ${m}`); fails++; };
const warn = (m) => { console.log(`WARN: ${m}`); warns++; };
const pass = (m) => console.log(`OK:   ${m}`);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts ?? {};

console.log('== verify-memory-claims ==');
console.log(`docs=${DOCS.join(', ')}  package.json scripts=${Object.keys(scripts).length}\n`);

/**
 * Illustrative globs, brace expansions, URLs and query strings are documentation
 * shorthand rather than real paths. `.env` files are gitignored by design, so their
 * absence is correct and must not fail the build.
 */
const isConcretePath = (p) =>
  !/[*?{}]/.test(p) &&
  !p.includes('...') &&
  !p.includes('://') &&
  !p.endsWith('/') &&
  !/(^|\/)\.env(\.|$)/.test(p) &&
  p.length < 160 &&
  /^(src|api|scripts|tests|integrations|deploy|supabase|public|\.cursor|\.github)\//.test(p);

/**
 * MEMORY legitimately records paths that were deliberately deleted, folded elsewhere,
 * or never built ("moved X → Y", "folded old X into Y", roadmap sections marked
 * PLAN ONLY). Those are history or intent, not rot. Writing one of these words on the
 * line opts it out of the existence check, which keeps the convention self-documenting.
 */
const HISTORICAL_MARKER = /\b(?:removed|historical|deleted|folded|superseded|planned|not built)\b/i;

/**
 * The "hot layer" is the part of a doc that gets read on every turn regardless of the task:
 * MEMORY's header, section map and quick context; SESSION_START's how-we-work and current
 * focus. Everything after it is opt-in — you land there having already routed, and you want
 * the detail. Budgets are enforced hard on the hot layer and reported below it.
 * Declared per doc rather than inferred, so moving a heading cannot silently move the line.
 */
const HOT_LAYER_RULES = {
  // Ends where topic sections begin. `## How to read this file` is itself navigation.
  'MEMORY.md': (lines) => lines.findIndex((l) => /^## /.test(l) && !/^## How to read/.test(l)),
  // Ends where the dated session log begins.
  'SESSION_START.md': (lines) => lines.findIndex((l) => /^## Last session/.test(l)),
};
const HOT_LAYER_END = (doc, lines) => {
  const rule = HOT_LAYER_RULES[doc];
  const idx = rule ? rule(lines) : -1;
  return idx > 0 ? idx : lines.length; // unknown doc: treat all of it as hot
};

/** Fenced code blocks contain `#` shell comments that are not markdown headings. */
const stripFences = (t) => t.replace(/```[\s\S]*?```/g, '');

for (const doc of DOCS) {
  if (!existsSync(doc)) { fail(`${doc} is missing`); continue; }
  const text = readFileSync(doc, 'utf8');
  const lines = text.split('\n');
  console.log(`--- ${doc} ---`);

  // 1. Documented commands must actually be runnable.
  const cmds = [...new Set([...text.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)].map((m) => m[1]))];
  const deadCmds = cmds.filter((c) => !(c in scripts));
  if (deadCmds.length) {
    fail(`${doc}: ${deadCmds.length}/${cmds.length} documented npm commands are not defined in package.json`);
    for (const c of deadCmds) console.log(`        npm run ${c}`);
    console.log('        → a bulk `git add .` commit has cut package.json scripts before (8fc667e);');
    console.log('          check `git log -p -- package.json` before assuming MEMORY is wrong.');
  } else {
    pass(`${doc}: all ${cmds.length} documented npm commands are defined`);
  }

  // 2. Cited repo paths must exist.
  const cited = new Map(); // path -> first line number, skipping lines marked historical
  lines.forEach((line, idx) => {
    if (HISTORICAL_MARKER.test(line)) return;
    for (const m of line.matchAll(/`([^`\n]+)`/g)) {
      const p = m[1].trim().replace(/[.,;:]+$/, '');
      if (!p.includes(' ') && isConcretePath(p) && !cited.has(p)) cited.set(p, idx + 1);
    }
  });
  const missing = [...cited].filter(([p]) => !existsSync(p));
  if (missing.length) {
    fail(`${doc}: ${missing.length}/${cited.size} cited repo paths do not exist`);
    for (const [p, n] of missing) console.log(`        L${n}: ${p}`);
    console.log('        → fix the path, or mark the line "(removed)" / "(planned)" if it is deliberate history.');
  } else {
    pass(`${doc}: all ${cited.size} cited repo paths exist`);
  }

  // 3. One H1 — multiple H1s mean concatenated docs and break section routing.
  const h1 = stripFences(text).split('\n').filter((l) => /^# \S/.test(l));
  if (h1.length === 1) pass(`${doc}: single H1`);
  else fail(`${doc}: found ${h1.length} H1 headings (expected 1) — likely concatenated content`);

  // 4. Secrets must never land in a tracked handoff doc.
  const secretPatterns = [
    [/sk-or-v1-[A-Za-z0-9]{20,}/g, 'OpenRouter key'],
    [/sk-ant-[A-Za-z0-9-]{20,}/g, 'Anthropic key'],
    [/nvapi-[A-Za-z0-9_-]{20,}/g, 'NVIDIA NIM key'],
    [/eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\./g, 'JWT'],
    [/ghp_[A-Za-z0-9]{30,}/g, 'GitHub PAT'],
    [/AKIA[0-9A-Z]{16}/g, 'AWS access key id'],
  ];
  let secretHits = 0;
  for (const [re, label] of secretPatterns) {
    if (re.test(text)) { fail(`${doc}: contains what looks like a committed ${label}`); secretHits++; }
  }
  if (!secretHits) pass(`${doc}: no secret-shaped literals`);

  // 5. Proxy-port drift. Only the 808x family is the free-claude-code proxy; 3002
  //    (9router) and 3000 (vite) are different services and are not drift.
  const undocumented = lines
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\b80[89]\d\b/.test(l) && !l.includes(CANONICAL_PROXY_PORT))
    .filter(([, l]) => !/supersed|migrat|previous|was stuck|legacy|old|clash|re-align/i.test(l));
  if (undocumented.length) {
    warn(`${doc}: ${undocumented.length} line(s) cite a non-canonical proxy port without a superseded/migration note (canonical is :${CANONICAL_PROXY_PORT})`);
    for (const [n, l] of undocumented.slice(0, 5)) console.log(`        L${n}: ${l.trim().slice(0, 110)}`);
  } else {
    pass(`${doc}: proxy-port references consistent with canonical :${CANONICAL_PROXY_PORT}`);
  }

  // 6. Retrieval budget — cost to consult, not style preference.
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > BUDGET.bytes) warn(`${doc}: ${(bytes / 1024).toFixed(0)}KB exceeds the ${(BUDGET.bytes / 1024).toFixed(0)}KB retrieval budget — archive dated history`);
  else pass(`${doc}: ${(bytes / 1024).toFixed(0)}KB within retrieval budget`);

  // Line length is layer-aware, because a flat threshold asks the wrong question of a
  // layered file. The hot region is read on every single turn, so an unskimmable line there
  // is a tax nobody opted into and it FAILs. Below it, a reader has already routed into one
  // section and wants the specifics, so density is reported but not penalised.
  const hotEnd = HOT_LAYER_END(doc, lines);
  const long = lines.map((l, i) => [i + 1, l.length]).filter(([, n]) => n > BUDGET.maxLineChars);
  const longHot = long.filter(([n]) => n <= hotEnd);
  const longCold = long.length - longHot.length;
  if (longHot.length) {
    fail(`${doc}: ${longHot.length} line(s) over ${BUDGET.maxLineChars} chars in the always-read hot region (L1-${hotEnd}) — split into bullets or move to a section`);
    for (const [n, c] of longHot.slice(0, 5)) console.log(`        L${n}: ${c} chars`);
  } else {
    pass(`${doc}: hot region (L1-${hotEnd}) has no lines over ${BUDGET.maxLineChars} chars${longCold ? `; ${longCold} dense line(s) below it, which is allowed` : ''}`);
  }

  const words = text.split(/\s+/).length;
  const boldSpans = (text.match(/\*\*/g) ?? []).length / 2;
  const ratio = words ? (boldSpans / words) * 100 : 0;
  if (ratio > BUDGET.boldRatioPct) {
    warn(`${doc}: ${ratio.toFixed(1)}% of words are bold (~${boldSpans} spans) — above ${BUDGET.boldRatioPct}%, emphasis stops carrying signal`);
  } else {
    pass(`${doc}: bold density ${ratio.toFixed(1)}% within budget`);
  }
  console.log('');
}

// 7. Cross-check: rule 07 routes agents into MEMORY sections, so those must resolve.
const RULE07 = '.cursor/rules/07-syncscript-app-knowledge.mdc';
if (existsSync(RULE07) && existsSync('MEMORY.md')) {
  console.log('--- cross-doc routing ---');
  const memory = readFileSync('MEMORY.md', 'utf8');
  const headings = memory.split('\n').filter((l) => /^#{1,4} /.test(l)).map((l) => l.replace(/^#+\s*/, '').toLowerCase());
  // `\*{0,2}` matters: rule 07 writes both `§ Name` and `§ **Name**`, and a class excluding
  // `*` silently skipped every bolded target — the gate reported "all resolve" while ignoring
  // three of them, which is the failure mode this whole file exists to prevent.
  const routed = [...new Set([...readFileSync(RULE07, 'utf8').matchAll(/§\s*\*{0,2}([^*|·\n]{4,60})/g)].map((m) => m[1].trim().toLowerCase()))];
  const unresolved = routed.filter((r) => {
    const key = r.replace(/[*`]/g, '').split('(')[0].trim();
    return key.length > 6 && !headings.some((h) => h.includes(key.slice(0, 18)));
  });
  if (unresolved.length) {
    warn(`${RULE07}: ${unresolved.length}/${routed.length} § routing targets do not match a MEMORY.md heading`);
    for (const u of unresolved.slice(0, 8)) console.log(`        § ${u}`);
  } else {
    pass(`${RULE07}: all ${routed.length} § routing targets resolve to MEMORY.md headings`);
  }
  console.log('');
}

// 7b. MEMORY's own § cross-references are its primary navigation and nothing checked them.
//     A § target that no longer matches a heading sends the reader scrolling through 1,500
//     lines. This caught two real cases on 2026-08-04: § Nexus "individual user" verify
//     profile and the dated-entry routes, both of which pointed at *bold lines* rather than
//     headings, so they were unreachable by heading search.
//     Only `**§ Name**` / `§ **Name**` counts — that is the convention here, and matching a
//     bare "§" would drag in prose that merely mentions the symbol.
if (existsSync('MEMORY.md')) {
  console.log('--- internal § navigation ---');
  const memory = readFileSync('MEMORY.md', 'utf8');
  const norm = (s) =>
    s
      .replace(/[*`]/g, '')
      .replace(/[“”„‟]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/[.,;:)\]]+$/, '')
      .trim()
      .toLowerCase();

  const headings = stripFences(memory)
    .split('\n')
    .filter((l) => /^#{2,4} /.test(l))
    .map((l) => norm(l.replace(/^#+\s*/, '')));

  const refs = new Set(
      // `§\s+\*\*` (not `\s*`) so the bare bold symbol in prose — `**§** sections + …` — is
      // not read as a reference to a section literally named "sections + …".
      [...memory.matchAll(/(?:\*\*§\s*([^*\n]{6,70})\*\*|§\s+\*\*([^*\n]{6,70})\*\*)/g)]
      // "§ Working notes → Nexus voice" targets the subsection after the arrow.
      .map((m) => norm((m[1] ?? m[2]).split('→').pop())
        .replace(/\s*\((?:agents?|ci|start here)[^)]*\)$/, ''))
      .filter((r) => r.length >= 8 && !/^\d/.test(r)),
  );

  const unresolved = [...refs].filter((r) => {
    const key = r.split('(')[0].trim();
    return !headings.some((h) => h.includes(key) || key.includes(h));
  });
  if (unresolved.length) {
    fail(`MEMORY.md: ${unresolved.length}/${refs.size} internal § references do not resolve to a heading`);
    for (const u of unresolved) console.log(`        § ${u}`);
    console.log('        → promote the target to a `###` heading, or fix the reference text.');
  } else {
    pass(`MEMORY.md: all ${refs.size} internal § references resolve to headings`);
  }
  console.log('');
}

// 8. Cortex ↔ MEMORY anti-rot: if the Last cortex gate is PASS, the always-read
//    hot layer must not still claim the morning-audit breakage as current fact.
//    History stays under § Historical defect — that's fine.
if (existsSync('MEMORY.md')) {
  console.log('--- cortex / MEMORY anti-rot ---');
  const memory = readFileSync('MEMORY.md', 'utf8');
  const gateBlock = memory.match(
    /<!-- cortex-gate:start -->[\s\S]*?<!-- cortex-gate:end -->/,
  );
  const gateText = gateBlock ? gateBlock[0] : '';
  const gatePass = /\*\*PASS\*\*|\bPASS\b/.test(gateText) && !/\*\*FAIL\*\*/.test(gateText);

  const hotEndIdx = HOT_LAYER_END('MEMORY.md', memory.split('\n'));
  const hotText = memory.split('\n').slice(0, hotEndIdx).join('\n');
  // Fossil phrases that were true morning 2026-08-04 and must not live as live routing.
  const fossils = [
    [/untracked and not compiling/i, 'untracked and not compiling'],
    [/31 cortex-related paths are untracked/i, '31 paths untracked (current claim)'],
    [/54 TypeScript errors across the surface/i, '54 type errors (current claim)'],
  ];
  let fossilHits = 0;
  for (const [re, label] of fossils) {
    if (re.test(hotText)) {
      fail(
        `MEMORY.md hot layer still claims "${label}" — that was the pre-repair audit. ` +
          (gatePass
            ? 'Last cortex gate is PASS; move the phrase under Historical defect only, or re-run verify:cortex if the platform regressed.'
            : 'Re-run npm run verify:cortex, or mark historical.'),
      );
      fossilHits++;
    }
  }
  if (!fossilHits) {
    pass(
      gatePass
        ? 'MEMORY.md hot layer does not restate pre-repair cortex fossils while gate is PASS'
        : 'MEMORY.md hot layer has no cortex fossil phrases (gate not yet PASS or missing)',
    );
  }

  if (gateBlock) {
    pass('MEMORY.md contains cortex-gate start/end markers for verify:cortex');
  } else {
    warn('MEMORY.md missing <!-- cortex-gate:start --> block — run npm run verify:cortex once to seed it');
  }
  console.log('');
}

// 9. Guard the guard: package.json aggregates must not reference undefined scripts.
const internalBad = Object.entries(scripts).flatMap(([name, body]) =>
  [...body.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)].map((m) => m[1]).filter((r) => !(r in scripts)).map((r) => [name, r]),
);
if (internalBad.length) {
  fail(`package.json: ${internalBad.length} script(s) reference undefined scripts (release gates will fail)`);
  for (const [a, b] of internalBad.slice(0, 12)) console.log(`        ${a} -> ${b}`);
} else {
  pass(`package.json: all ${Object.keys(scripts).length} scripts resolve internally`);
}

console.log('');
const label = STRICT ? 'FAIL+WARN' : 'FAIL';
if (fails || (STRICT && warns)) {
  console.log(`Summary: FAILED — ${fails} fail, ${warns} warn (${label} blocks).`);
  process.exit(1);
}
console.log(`Summary: PASSED — ${fails} fail, ${warns} warn.`);
