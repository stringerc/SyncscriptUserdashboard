#!/usr/bin/env node
/**
 * Cortex Proposals & Fleet Out-of-Band CLI
 *
 * Emergency fallback and direct operator control tool.
 * Works both ONLINE (via Vite /api/cortex/* endpoints) and
 * OFFLINE (reading/writing .cortex-runtime/ directly if Vite or Discord is down).
 *
 * Usage:
 *   node scripts/cortex-proposals.mjs list
 *   node scripts/cortex-proposals.mjs approve <id>
 *   node scripts/cortex-proposals.mjs dismiss <id>
 *   node scripts/cortex-proposals.mjs approve-all
 *   node scripts/cortex-proposals.mjs status
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const CORTEX_URL = process.env.CORTEX_LOCAL_URL || 'http://127.0.0.1:5173';
const RUNTIME_DIR = path.resolve(process.cwd(), '.cortex-runtime');
const STRAT_FILE = path.join(RUNTIME_DIR, 'strategy-proposals.json');
const AGENTS_FILE = path.join(RUNTIME_DIR, 'agents-state.json');

async function isServerUp(url = CORTEX_URL) {
  try {
    const res = await fetch(`${url}/api/cortex/agents/state`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function listProposals() {
  const online = await isServerUp();
  if (online) {
    try {
      const res = await fetch(`${CORTEX_URL}/api/cortex/agents/proposals?status=pending`);
      const data = await res.json();
      const proposals = data.proposals || [];
      console.log(`\n📋 Pending Strategy Proposals (Live from ${CORTEX_URL}) — Total: ${proposals.length}\n`);
      if (proposals.length === 0) {
        console.log('  ✨ No pending proposals. Fleet queue clear.');
        return;
      }
      for (const p of proposals) {
        console.log(`• ID: \x1b[36m${p.id}\x1b[0m`);
        console.log(`  Agent: \x1b[33m${p.agentId || 'fleet'}\x1b[0m | Kind: ${p.kind} | Class: ${p.actionClass || 'process'}`);
        console.log(`  Title: \x1b[1m${p.title}\x1b[0m`);
        if (p.instruction) console.log(`  Ask:   ${p.instruction.slice(0, 160)}`);
        if (Array.isArray(p.evidence) && p.evidence.length) {
          console.log(`  Evid:  ${p.evidence.slice(0, 2).join('; ')}`);
        }
        console.log('');
      }
      return;
    } catch (e) {
      console.warn(`[WARN] Failed fetching online, falling back to disk: ${e.message}`);
    }
  }

  // Offline fallback: direct disk inspection
  console.log(`\n📋 Pending Strategy Proposals (OFFLINE from ${STRAT_FILE})\n`);
  try {
    if (!fs.existsSync(STRAT_FILE)) {
      console.log('  ⚠️ No strategy-proposals.json found.');
      return;
    }
    const raw = JSON.parse(fs.readFileSync(STRAT_FILE, 'utf8'));
    const pending = (raw.proposals || []).filter((p) => p.status === 'pending');
    console.log(`Total Pending: ${pending.length}\n`);
    if (pending.length === 0) {
      console.log('  ✨ No pending proposals found in offline ledger.');
      return;
    }
    for (const p of pending) {
      console.log(`• ID: \x1b[36m${p.id}\x1b[0m`);
      console.log(`  Agent: \x1b[33m${p.agentId || 'fleet'}\x1b[0m | Kind: ${p.kind} | Class: ${p.actionClass || 'process'}`);
      console.log(`  Title: \x1b[1m${p.title}\x1b[0m`);
      if (p.instruction) console.log(`  Ask:   ${p.instruction.slice(0, 160)}`);
      console.log('');
    }
  } catch (err) {
    console.error(`Error reading offline proposals: ${err.message}`);
  }
}

async function decideProposal(id, decision) {
  if (!id) {
    console.error('Error: Proposal ID required.');
    process.exit(1);
  }
  const online = await isServerUp();
  if (online) {
    try {
      const res = await fetch(`${CORTEX_URL}/api/cortex/agents/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        console.log(`\x1b[32m✔ Successfully ${decision}: ${id}\x1b[0m${data.note ? ` (${data.note})` : ''}`);
        return;
      } else {
        console.error(`\x1b[31m✖ Failed to ${decision} ${id}: ${data.error || res.statusText}\x1b[0m`);
        return;
      }
    } catch (e) {
      console.warn(`[WARN] Online dispatch failed (${e.message}), attempting offline fallback...`);
    }
  }

  // Offline fallback
  try {
    if (!fs.existsSync(STRAT_FILE)) {
      console.error(`Error: ${STRAT_FILE} does not exist.`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(STRAT_FILE, 'utf8'));
    const item = (raw.proposals || []).find((p) => p.id === id);
    if (!item) {
      console.error(`Error: Proposal ${id} not found.`);
      process.exit(1);
    }
    item.status = decision;
    item.decidedAt = Date.now();
    item.decidedBy = 'cli-offline';
    fs.writeFileSync(STRAT_FILE, JSON.stringify(raw, null, 2));
    console.log(`\x1b[32m✔ [OFFLINE] Updated ${id} to ${decision} in ${STRAT_FILE}\x1b[0m`);
  } catch (err) {
    console.error(`Error updating offline ledger: ${err.message}`);
    process.exit(1);
  }
}

async function approveAll() {
  const online = await isServerUp();
  if (online) {
    try {
      const res = await fetch(`${CORTEX_URL}/api/cortex/agents/proposals/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        console.log(`\x1b[32m✔ Approved all pending proposals: ${data.approved}/${data.count}\x1b[0m`);
        return;
      }
    } catch (e) {
      console.warn(`Batch API failed: ${e.message}`);
    }
  }

  // Offline batch
  try {
    const raw = JSON.parse(fs.readFileSync(STRAT_FILE, 'utf8'));
    let count = 0;
    for (const p of raw.proposals || []) {
      if (p.status === 'pending') {
        p.status = 'approved';
        p.decidedAt = Date.now();
        p.decidedBy = 'cli-offline-batch';
        count++;
      }
    }
    fs.writeFileSync(STRAT_FILE, JSON.stringify(raw, null, 2));
    console.log(`\x1b[32m✔ [OFFLINE] Approved ${count} proposals in ledger.\x1b[0m`);
  } catch (err) {
    console.error(`Error batch approving: ${err.message}`);
  }
}

async function checkFleetStatus() {
  console.log('\n🔍 Cortex Fleet & Infrastructure Status\n');

  // Check 1: Vite Dev Server
  const viteUp = await isServerUp();
  console.log(`• Vite Host (:5173):      ${viteUp ? '\x1b[32m● ONLINE (HTTP 200)\x1b[0m' : '\x1b[31m○ OFFLINE\x1b[0m'}`);

  // Check 2: Hermes Server
  let hermesStatus = '\x1b[31m○ OFFLINE\x1b[0m';
  try {
    const hres = await fetch('http://127.0.0.1:18880/health', { signal: AbortSignal.timeout(1500) });
    if (hres.ok) hermesStatus = '\x1b[32m● ONLINE (Port 18880)\x1b[0m';
  } catch {}
  console.log(`• Hermes Mock Server:     ${hermesStatus}`);

  // Check 3: Pocket TTS (:8911) & Cortana TTS (:8910)
  let ttsStatus = '\x1b[31m○ OFFLINE\x1b[0m';
  try {
    const pres = await fetch('http://127.0.0.1:8911', { signal: AbortSignal.timeout(1500) });
    if (pres.status < 500) ttsStatus = '\x1b[32m● ONLINE (Pocket :8911 & Cortana :8910)\x1b[0m';
  } catch {}
  console.log(`• Voice Engine:           ${ttsStatus}`);

  // Check 4: Discord Surface Health
  let discordHealth = '\x1b[33m○ UNKNOWN\x1b[0m';
  if (viteUp) {
    try {
      const dres = await fetch(`${CORTEX_URL}/api/cortex/discord/health`, { signal: AbortSignal.timeout(1500) });
      if (dres.ok) {
        const dj = await dres.json();
        discordHealth = dj.discordConfigured
          ? `\x1b[32m● CONFIGURED (Owner: ${dj.ownerId}, Push Budget: ${dj.pushState?.count ?? 0}/5 today)\x1b[0m`
          : '\x1b[31m○ UNCONFIGURED (Missing DISCORD_* env)\x1b[0m';
      }
    } catch {}
  }
  console.log(`• Discord Integration:    ${discordHealth}`);

  // Check 5: Fleet Agents Snapshot
  if (viteUp) {
    try {
      const ares = await fetch(`${CORTEX_URL}/api/cortex/agents/state`);
      const state = await ares.json();
      const agents = Array.isArray(state?.agents) ? state.agents : [];
      const active = agents.filter((a) => a.status !== 'retired');
      const working = active.filter((a) => a.status === 'working' || a.status === 'active').length;
      const idle = active.filter((a) => a.status === 'idle').length;
      console.log(`• Fleet Active Agents:    \x1b[32m${active.length} agents total\x1b[0m (${working} working, ${idle} idle)`);
    } catch {}
  } else if (fs.existsSync(AGENTS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
      const active = (raw.agents || []).filter((a) => a.status !== 'retired');
      console.log(`• Fleet Active Agents:    \x1b[33m${active.length} agents (from offline agents-state.json)\x1b[0m`);
    } catch {}
  }

  // Check 6: Pending Proposals
  if (fs.existsSync(STRAT_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(STRAT_FILE, 'utf8'));
      const pending = (raw.proposals || []).filter((p) => p.status === 'pending');
      console.log(`• Pending Proposals:      \x1b[36m${pending.length} awaiting decision\x1b[0m (run 'node scripts/cortex-proposals.mjs list')`);
    } catch {}
  }
  console.log('');
}

const [cmd, arg] = process.argv.slice(2);

switch (cmd) {
  case 'list':
  case 'ls':
    await listProposals();
    break;
  case 'approve':
  case 'accept':
    await decideProposal(arg, 'approved');
    break;
  case 'dismiss':
  case 'reject':
    await decideProposal(arg, 'dismissed');
    break;
  case 'approve-all':
    await approveAll();
    break;
  case 'status':
    await checkFleetStatus();
    break;
  default:
    console.log(`
Cortex Proposals & Fleet CLI (Out-of-Band Fallback)

Commands:
  node scripts/cortex-proposals.mjs status         - Check fleet, daemon, and discord health
  node scripts/cortex-proposals.mjs list           - List all pending strategy proposals
  node scripts/cortex-proposals.mjs approve <id>   - Approve and dispatch proposal
  node scripts/cortex-proposals.mjs dismiss <id>   - Dismiss proposal
  node scripts/cortex-proposals.mjs approve-all    - Approve all pending proposals
`);
    break;
}
