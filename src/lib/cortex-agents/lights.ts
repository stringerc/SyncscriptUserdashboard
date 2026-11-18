/**
 * Deterministic physical-lights tasks — no LLM required.
 *
 * 'lights_status' and 'lights_set' are handled directly by the runtime
 * (see DETERMINISTIC_TASKS) so a light query never burns a deep-lane
 * model call and never depends on the model guessing a shell command.
 *
 * Honesty note: the Govee OpenAPI is write-only — it exposes device
 * control but NOT live power/brightness/color state. lights_status
 * therefore reports reachability + controllability, not fabricated
 * state readings.
 */

import {
  broadcastBrightness,
  broadcastColor,
  broadcastPower,
  COLOR_PRESETS,
  getGoveeApiKey,
  getGoveeDevices,
  hexToRgbInt,
  syncCortexMoodToLights,
  type CortexMood,
} from '../../utils/govee-client';
import type { AgentContext } from './runtime';

const COLOR_ALIASES: Record<string, string> = {
  red: '#ff0000', blue: '#0000ff', green: '#00ff00', purple: '#a855f7',
  pink: '#ec4899', orange: '#f97316', yellow: '#eab308', cyan: '#00e5ff',
  magenta: '#ff00ff', teal: '#14b8a6', warm: '#ffedd5', white: '#ffffff',
  warmwhite: '#ffedd5', daylight: '#fff4e0',
};

const MOODS = new Set(['idle', 'listening', 'thinking', 'speaking', 'working', 'alert']);

export interface ParsedLightOps {
  power?: 'on' | 'off';
  brightness?: number;
  colorHex?: string;
  mood?: CortexMood;
  /** Set when the text could not be mapped to any operation. */
  unparsed?: string;
}

/** Deterministic NL parse for lights_set — covers the common Crew phrasings. */
export function parseLightCommand(text: string): ParsedLightOps {
  const t = text.toLowerCase();
  const ops: ParsedLightOps = {};

  if (/\b(turn|switch|power)\b.*\b(off|out)\b|\blights? off\b|\bturn off\b/.test(t)) ops.power = 'off';
  else if (/\b(turn|switch|power)\b.*\b(on|in)\b|\blights? on\b|\bturn on\b/.test(t)) ops.power = 'on';

  const bright = t.match(/(\d{1,3})\s*%|brightness\s*(?:to|at|=|of)?\s*(\d{1,3})|dim\b[^0-9%]{0,25}(\d{1,3})/);
  if (bright) {
    const n = parseInt(bright[1] || bright[2] || bright[3], 10);
    if (n >= 0 && n <= 100) ops.brightness = n;
  } else if (/\bdim\b|\bdarker\b/.test(t) && !ops.brightness) {
    ops.brightness = 30;
  } else if (/\bbrighter\b|\bmax\b/.test(t) && !ops.brightness) {
    ops.brightness = 100;
  }

  const hex = t.match(/#([0-9a-f]{6})\b/);
  if (hex) ops.colorHex = `#${hex[1]}`;
  else {
    for (const [name, preset] of Object.entries(COLOR_PRESETS)) {
      if (new RegExp(`\\b${name}\\b`).test(t)) { ops.colorHex = preset.hex; break; }
    }
    if (!ops.colorHex) {
      for (const [alias, h] of Object.entries(COLOR_ALIASES)) {
        if (new RegExp(`\\b${alias}\\b`).test(t)) { ops.colorHex = h; break; }
      }
    }
  }

  for (const m of MOODS) {
    if (new RegExp(`\\b(mood[:\\s]+)?${m}\\b`).test(t) && /mood|vibe|mode/.test(t)) {
      ops.mood = m as CortexMood;
      break;
    }
  }

  if (!ops.power && ops.brightness === undefined && !ops.colorHex && !ops.mood) {
    ops.unparsed = text.slice(0, 140);
  }
  return ops;
}

function goveeKey(): string {
  const key = getGoveeApiKey();
  if (!key) throw new Error('GOVEE_API_KEY not configured in environment');
  return key;
}

async function lightsStatus(ctx: AgentContext) {
  ctx.progress(0.3);
  const devices = await getGoveeDevices(goveeKey());
  ctx.progress(1);
  if (!devices.length) throw new Error('Govee API reachable but returned zero devices');
  return {
    reachable: true,
    deviceCount: devices.length,
    devices: devices.map((d) => ({ name: d.deviceName, sku: d.sku, type: d.type })),
    stateNote:
      'Govee OpenAPI is write-only — live power/brightness/color state is not exposed. ' +
      'This confirms the lights are reachable and controllable, not their current settings.',
  };
}

async function lightsSet(ctx: AgentContext) {
  const input = ctx.task.input || {};
  const explicit = {
    power: input.power === 'on' || input.power === 'off' ? (input.power as 'on' | 'off') : undefined,
    brightness: typeof input.brightness === 'number' ? Math.max(0, Math.min(100, input.brightness)) : undefined,
    colorHex: typeof input.color === 'string' && input.color.trim() ? input.color.trim() : undefined,
    mood: typeof input.mood === 'string' && MOODS.has(input.mood) ? (input.mood as CortexMood) : undefined,
  };
  const parsed = typeof input.instruction === 'string' || typeof input.text === 'string'
    ? parseLightCommand(String(input.instruction || input.text))
    : { unparsed: undefined as string | undefined };
  const ops: ParsedLightOps = {
    power: explicit.power ?? parsed.power,
    brightness: explicit.brightness ?? parsed.brightness,
    colorHex: explicit.colorHex ?? parsed.colorHex,
    mood: explicit.mood ?? parsed.mood,
    unparsed: parsed.unparsed,
  };
  if (ops.unparsed || (!ops.power && ops.brightness === undefined && !ops.colorHex && !ops.mood)) {
    throw new Error(
      `lights_set could not parse a light operation from: "${String(input.instruction || input.text || '').slice(0, 80)}". ` +
      'Supported: power on/off, brightness <0-100>, color <name|#hex|preset>, mood <idle|listening|thinking|speaking|working|alert>.',
    );
  }

  const apiKey = goveeKey();
  const applied: string[] = [];
  ctx.progress(0.2);
  if (ops.power) {
    const r = await broadcastPower(apiKey, ops.power);
    if (!r.success) throw new Error(`broadcastPower(${ops.power}) failed for all devices`);
    applied.push(`power=${ops.power} (${r.updated} devices)`);
    ctx.progress(0.5);
  }
  if (ops.brightness !== undefined) {
    const r = await broadcastBrightness(apiKey, ops.brightness);
    if (!r.success) throw new Error(`broadcastBrightness(${ops.brightness}) failed for all devices`);
    applied.push(`brightness=${ops.brightness}% (${r.updated} devices)`);
    ctx.progress(0.7);
  }
  if (ops.colorHex) {
    const { intVal, hex } = hexToRgbInt(ops.colorHex);
    const r = await broadcastColor(apiKey, intVal);
    if (!r.success) throw new Error(`broadcastColor(${hex}) failed for all devices`);
    applied.push(`color=${hex} (${r.updated} devices)`);
    ctx.progress(0.85);
  }
  if (ops.mood) {
    const r = await syncCortexMoodToLights(apiKey, ops.mood);
    if (!r.success) throw new Error(`syncCortexMoodToLights(${ops.mood}) failed`);
    applied.push(`mood=${ops.mood} (${r.hex})`);
  }
  ctx.progress(1);
  return { applied, ops };
}

/** Kinds the runtime executes directly — bypassing the agent's LLM worker. */
export const DETERMINISTIC_TASKS: Record<string, (ctx: AgentContext) => Promise<unknown>> = {
  lights_status: lightsStatus,
  lights_set: lightsSet,
};
