/**
 * Shared signal plumbing for CortexCoreSceneV2 — mirrors V1's LiveSignal
 * contract so both scenes respond identically to cortexSignalBus.
 */

import * as THREE from 'three';
import type { CortexVoiceState } from './CortexVisualizer';

const c = (hex: string) => new THREE.Color(hex);

export const STATE_COLORS_V2: Record<CortexVoiceState, { core: string; rim: string; deep: string; energy: number; cCore: THREE.Color; cRim: THREE.Color; cDeep: THREE.Color }> = {
  idle: { core: '#124a5e', rim: '#38d9f5', deep: '#020a12', energy: 0.45, cCore: c('#124a5e'), cRim: c('#38d9f5'), cDeep: c('#020a12') },
  listening: { core: '#063d2e', rim: '#34d399', deep: '#020d08', energy: 0.5, cCore: c('#063d2e'), cRim: c('#34d399'), cDeep: c('#020d08') },
  thinking: { core: '#2e1065', rim: '#a78bfa', deep: '#0a0618', energy: 0.75, cCore: c('#2e1065'), cRim: c('#a78bfa'), cDeep: c('#0a0618') },
  speaking: { core: '#3a2c05', rim: '#fcd34d', deep: '#120c02', energy: 1.0, cCore: c('#3a2c05'), cRim: c('#fcd34d'), cDeep: c('#120c02') },
  working: { core: '#4a044e', rim: '#e879f9', deep: '#12041a', energy: 0.68, cCore: c('#4a044e'), cRim: c('#e879f9'), cDeep: c('#12041a') },
};

export interface LiveSignalV2 {
  state: CortexVoiceState;
  level: number;
  rawLevel: number;
  energy: number;
  kick: number;
  clockT: number;
  colorCore: THREE.Color;
  colorRim: THREE.Color;
  colorDeep: THREE.Color;
  text: string;
  phi: number;
  phiS: number;
  think: number;
  channel: string;
  eventSeq: number;
  ingest: number;
}

export function makeLiveForV2(): LiveSignalV2 {
  return {
    state: 'idle',
    level: 0,
    rawLevel: 0,
    energy: STATE_COLORS_V2.idle.energy,
    kick: 0,
    clockT: 0,
    colorCore: c(STATE_COLORS_V2.idle.core),
    colorRim: c(STATE_COLORS_V2.idle.rim),
    colorDeep: c(STATE_COLORS_V2.idle.deep),
    text: '',
    phi: 0,
    phiS: 0,
    think: 0,
    channel: '',
    eventSeq: 0,
    ingest: 0,
  };
}

export function tickLiveForV2(live: LiveSignalV2, delta: number, t: number) {
  const target = STATE_COLORS_V2[live.state];
  const attack = live.rawLevel > live.level ? 16 : 5;
  live.level += (live.rawLevel - live.level) * Math.min(1, delta * attack);
  live.energy += (target.energy - live.energy) * Math.min(1, delta * 3.2);
  live.kick *= Math.exp(-delta * 2.4);
  live.ingest *= Math.exp(-delta * 2.8);
  live.clockT = t;
  live.colorCore.lerp(target.cCore, Math.min(1, delta * 2.4));
  live.colorRim.lerp(target.cRim, Math.min(1, delta * 2.4));
  live.colorDeep.lerp(target.cDeep, Math.min(1, delta * 2.0));
  live.phiS += (live.phi - live.phiS) * Math.min(1, delta * 0.8);
  const thinkTarget = live.state === 'thinking' || live.state === 'working' ? 1 : 0;
  live.think += (thinkTarget - live.think) * Math.min(1, delta * (thinkTarget > live.think ? 1.4 : 0.5));
}
