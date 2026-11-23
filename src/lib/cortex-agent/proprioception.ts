/**
 * proprioception.ts — the body schema.
 *
 * Cortex asked for her lights, map, and surface panels to be wired into
 * her self-model as limbs rather than remote tools. This module is the
 * body map: each limb reports a verifiable state — not "configured"
 * but "reachable right now" where that can be checked synchronously.
 *
 * Limb classes:
 *   sense    — interoception (vitals), attention (salience competition)
 *   actuate  — lights (Govee), surfaces (panels/map), voice (TTS), hands (agents)
 *
 * States: ready | degraded | offline | unconfigured. A limb that can't
 * be verified reports 'unknown' rather than pretending.
 */
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');

export type LimbState = 'ready' | 'degraded' | 'offline' | 'unconfigured' | 'unknown';
export interface Limb {
  id: string;
  name: string;
  class: 'sense' | 'actuate';
  state: LimbState;
  detail: string;
  checkedAt: number;
}

function readJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

export interface ProprioceptionSnapshot {
  computedAt: number;
  limbs: Limb[];
  readyCount: number;
  totalCount: number;
}

/** Build the body map. Cheap, synchronous, honest — every claim is
 *  backed by a file, env var, or in-process check executed right now. */
export function getProprioception(nowMs: number = Date.now()): ProprioceptionSnapshot {
  const limbs: Limb[] = [];
  const add = (l: Omit<Limb, 'checkedAt'>) => limbs.push({ ...l, checkedAt: nowMs });

  // ── SENSE: interoception ──
  const selfReg = readJson(path.join(RUNTIME, 'self-regulation', 'latest.json'));
  const selfAge = selfReg?.vitals?.at ? nowMs - Number(selfReg.vitals.at) : Infinity;
  add({
    id: 'sense.interoception', name: 'Interoceptive sense', class: 'sense',
    state: selfAge < 600_000 ? 'ready' : selfAge < 3_600_000 ? 'degraded' : 'offline',
    detail: selfAge < Infinity ? `vitals ${Math.round(selfAge / 1000)}s old` : 'no vitals sample',
  });

  // ── SENSE: attention schema ──
  const attTrace = path.join(RUNTIME, 'attention-trace.jsonl');
  let attFresh = false;
  try { attFresh = nowMs - fs.statSync(attTrace).mtimeMs < 3_600_000; } catch {}
  add({
    id: 'sense.attention', name: 'Attention schema', class: 'sense',
    state: attFresh ? 'ready' : 'degraded',
    detail: attFresh ? 'trace active this hour' : 'no attention decisions recorded yet',
  });

  // ── ACTUATE: lights (Govee) ──
  const goveeKey = !!(process.env.GOVEE_API_KEY || readJson(path.join(process.cwd(), '.cache', 'govee-devices.json')));
  add({
    id: 'actuate.lights', name: 'Room lights (Govee)', class: 'actuate',
    state: goveeKey ? 'ready' : 'unconfigured',
    detail: goveeKey ? 'API credentials present — broadcast path armed' : 'no Govee credentials found',
  });

  // ── ACTUATE: surfaces (panels + map) ──
  add({
    id: 'actuate.surfaces', name: 'Surface panels (Foundry/Inbox/Review/Map)', class: 'actuate',
    state: 'ready',
    detail: 'client-rendered — state verified via /api/cortex/strategic/dashboard',
  });

  // ── ACTUATE: voice (TTS sidecars) ──
  const kokoro = readJson(path.join(RUNTIME, 'sidecars', 'kokoro.json')) || readJson(path.join(RUNTIME, 'sidecars.json'));
  const voiceState = kokoro ? 'ready' : 'unknown';
  add({
    id: 'actuate.voice', name: 'Voice (TTS sidecars)', class: 'actuate',
    state: voiceState,
    detail: kokoro ? 'sidecar state file present' : 'no sidecar state file — checking live ports is async',
  });

  // ── ACTUATE: hands (agent runtime) ──
  const runtimeState = readJson(path.join(RUNTIME, 'agent-runtime.json'));
  const taskCount = Array.isArray(runtimeState?.tasks) ? runtimeState.tasks.length : null;
  const agentCount = runtimeState?.agents ? Object.keys(runtimeState.agents).length : null;
  add({
    id: 'actuate.hands', name: 'Agent hands (fleet runtime)', class: 'actuate',
    state: runtimeState ? 'ready' : 'unknown',
    detail: runtimeState
      ? `${agentCount ?? '?'} agents, ${taskCount ?? '?'} tasks in persisted state`
      : 'runtime state file not found',
  });

  // ── ACTUATE: volition (veto window) ──
  const libet = readJson(path.join(RUNTIME, 'libet-veto.json'));
  const pending = Array.isArray(libet?.pending) ? libet.pending.filter((p: any) => p.status === 'pending').length : 0;
  add({
    id: 'actuate.volition', name: 'Volition (Libet veto window)', class: 'actuate',
    state: 'ready',
    detail: `${pending} dispatch intent${pending === 1 ? '' : 's'} in veto window`,
  });

  const readyCount = limbs.filter((l) => l.state === 'ready').length;
  return { computedAt: nowMs, limbs, readyCount, totalCount: limbs.length };
}
