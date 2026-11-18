/**
 * Govee Smart Lighting Client for Cortex & SyncScript
 * Integrates physical RGBIC lights (TV Backlight + LED Strip) with Cortex visualizer states & voice agency.
 */

import fs from 'node:fs';
import path from 'node:path';

let cachedApiKey: string | null = null;

/**
 * Resolve the Govee API key. The vite dev server loads .env via loadEnv()
 * into a local record — process.env.GOVEE_API_KEY stays empty inside
 * middleware, which previously made every light call report "offline".
 * Falls back to parsing .env directly. Skipped under vitest so tests
 * stay hermetic.
 */
export function getGoveeApiKey(): string {
  if (cachedApiKey !== null) return cachedApiKey;
  let key = process.env.GOVEE_API_KEY || '';
  if (!key && !process.env.VITEST) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^\s*GOVEE_API_KEY\s*=\s*(.*)\s*$/);
        if (m) { key = m[1].trim().replace(/^["']|["']$/g, ''); break; }
      }
    } catch { /* .env unreadable — key stays empty */ }
  }
  cachedApiKey = key;
  return key;
}

export interface GoveeDevice {
  sku: string;
  device: string;
  deviceName: string;
  type: string;
  capabilities: any[];
}

export type CortexMood = 'idle' | 'listening' | 'thinking' | 'speaking' | 'working' | 'alert';

export const CORTEX_MOOD_COLORS: Record<CortexMood, { hex: string; r: number; g: number; b: number; intVal: number }> = {
  idle:      { hex: '#38d9f5', r: 56,  g: 217, b: 245, intVal: (56 << 16) | (217 << 8) | 245 },
  listening: { hex: '#34d399', r: 52,  g: 211, b: 153, intVal: (52 << 16) | (211 << 8) | 153 },
  thinking:  { hex: '#a78bfa', r: 167, g: 139, b: 250, intVal: (167 << 16) | (139 << 8) | 250 },
  speaking:  { hex: '#38bdf8', r: 56,  g: 189, b: 248, intVal: (56 << 16) | (189 << 8) | 248 },
  working:   { hex: '#e879f9', r: 232, g: 121, b: 249, intVal: (232 << 16) | (121 << 8) | 249 },
  alert:     { hex: '#f43f5e', r: 244, g: 63,  b: 94,  intVal: (244 << 16) | (63 << 8) | 94 },
};

export const COLOR_PRESETS: Record<string, { hex: string; r: number; g: number; b: number; intVal: number }> = {
  cyberpunk: { hex: '#e879f9', r: 232, g: 121, b: 249, intVal: 15235577 },
  matrix:    { hex: '#22c55e', r: 34,  g: 197, b: 94,  intVal: 2278750 },
  neon_blue: { hex: '#00e5ff', r: 0,   g: 229, b: 255, intVal: 58879 },
  sunset:    { hex: '#f97316', r: 249, g: 115, b: 22,  intVal: 16347926 },
  gold:      { hex: '#eab308', r: 234, g: 179, b: 8,   intVal: 15381256 },
  crimson:   { hex: '#ef4444', r: 239, g: 68,  b: 68,  intVal: 15680580 },
  stealth:   { hex: '#1e1b4b', r: 30,  g: 27,  b: 75,  intVal: 1973067 },
  white:     { hex: '#ffffff', r: 255, g: 255, b: 255, intVal: 16777215 },
  warm_white:{ hex: '#ffedd5', r: 255, g: 237, b: 213, intVal: 16772565 },
};

export function hexToRgbInt(hex: string): { hex: string; r: number; g: number; b: number; intVal: number } {
  const clean = hex.replace('#', '').trim();
  let r = 255, g = 255, b = 255;
  if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  }
  const intVal = (r << 16) | (g << 8) | b;
  return { hex: `#${clean}`, r, g, b, intVal };
}

let cachedDevices: GoveeDevice[] | null = [
  {
    sku: 'H6168',
    device: '1B:49:D5:33:C1:46:35:3C',
    deviceName: 'RGBIC TV Backlight',
    type: 'devices.types.light',
    capabilities: [],
  },
  {
    sku: 'H618F',
    device: '19:52:E4:5E:86:06:2B:7D',
    deviceName: 'RGBIC LED Strip Light',
    type: 'devices.types.light',
    capabilities: [],
  },
];
let lastDeviceFetch = Date.now();

export async function getGoveeDevices(apiKey: string): Promise<GoveeDevice[]> {
  if (cachedDevices && Date.now() - lastDeviceFetch < 300_000) {
    return cachedDevices;
  }
  try {
    const res = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', {
      headers: {
        'Govee-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Govee devices HTTP ${res.status}`);
    const data = await res.json();
    if (data.code === 200 && Array.isArray(data.data)) {
      cachedDevices = data.data;
      lastDeviceFetch = Date.now();
      return cachedDevices;
    }
  } catch (err) {
    console.warn('[Govee] Failed to refresh devices from API, using fallback cache:', err);
  }
  return cachedDevices || [];
}

/** Rate-limiting tracker to prevent exceeding Govee OpenAPI concurrency thresholds */
let lastCallHead = 0;
const MIN_INTERVAL_MS = 350;

async function throttleCall<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const wait = Math.max(0, lastCallHead + MIN_INTERVAL_MS - now);
  lastCallHead = now + wait;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  return fn();
}

/** Control a single Govee device capability */
export async function controlGoveeDevice(
  apiKey: string,
  sku: string,
  device: string,
  capability: { type: string; instance: string; value: any }
): Promise<boolean> {
  return throttleCall(async () => {
    try {
      const res = await fetch('https://openapi.api.govee.com/router/api/v1/device/control', {
        method: 'POST',
        headers: {
          'Govee-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: `cx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          payload: {
            sku,
            device,
            capability,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      return res.ok && json.code === 200;
    } catch (err) {
      console.error(`[Govee] Control failed for ${sku} (${device}):`, err);
      return false;
    }
  });
}

/** Broadcast color change to all user Govee lights */
export async function broadcastColor(apiKey: string, intVal: number, devices?: GoveeDevice[]): Promise<{ success: boolean; updated: number }> {
  const targets = devices && devices.length ? devices : await getGoveeDevices(apiKey);
  let updated = 0;
  for (const dev of targets) {
    const ok = await controlGoveeDevice(apiKey, dev.sku, dev.device, {
      type: 'devices.capabilities.color_setting',
      instance: 'colorRgb',
      value: intVal,
    });
    if (ok) updated++;
  }
  return { success: updated > 0, updated };
}

/** Broadcast power on/off */
export async function broadcastPower(apiKey: string, power: 'on' | 'off', devices?: GoveeDevice[]): Promise<{ success: boolean; updated: number }> {
  const targets = devices && devices.length ? devices : await getGoveeDevices(apiKey);
  let updated = 0;
  for (const dev of targets) {
    const ok = await controlGoveeDevice(apiKey, dev.sku, dev.device, {
      type: 'devices.capabilities.on_off',
      instance: 'powerSwitch',
      value: power === 'on' ? 1 : 0,
    });
    if (ok) updated++;
  }
  return { success: updated > 0, updated };
}

/** Broadcast brightness (1-100) */
export async function broadcastBrightness(apiKey: string, brightness: number, devices?: GoveeDevice[]): Promise<{ success: boolean; updated: number }> {
  const val = Math.max(1, Math.min(100, Math.round(brightness)));
  const targets = devices && devices.length ? devices : await getGoveeDevices(apiKey);
  let updated = 0;
  for (const dev of targets) {
    const ok = await controlGoveeDevice(apiKey, dev.sku, dev.device, {
      type: 'devices.capabilities.range',
      instance: 'brightness',
      value: val,
    });
    if (ok) updated++;
  }
  return { success: updated > 0, updated };
}

/** Broadcast dynamic music mode / RGBIC light show (Spectrum / Energic / Rhythm / Rolling) */
export async function broadcastLightShow(
  apiKey: string,
  modeName: 'spectrum' | 'energic' | 'rhythm' | 'rolling' | 'separation' = 'spectrum',
  devices?: GoveeDevice[]
): Promise<{ success: boolean; mode: string; updated: number }> {
  const modeMap: Record<string, number> = {
    energic: 1,
    rhythm: 2,
    spectrum: 3,
    rolling: 4,
    separation: 5,
  };
  const modeVal = modeMap[modeName.toLowerCase()] ?? 3;
  const targets = devices && devices.length ? devices : await getGoveeDevices(apiKey);

  // Turn on and set brightness concurrently, then activate dynamic hardware musicMode
  const results = await Promise.allSettled(
    targets.map(async (dev) => {
      // 1. Ensure powered on
      await controlGoveeDevice(apiKey, dev.sku, dev.device, {
        type: 'devices.capabilities.on_off',
        instance: 'powerSwitch',
        value: 1,
      }).catch(() => false);

      // 2. Set dynamic hardware musicMode (hardware DSP reacts to ambient sound/music)
      return controlGoveeDevice(apiKey, dev.sku, dev.device, {
        type: 'devices.capabilities.music_setting',
        instance: 'musicMode',
        value: {
          musicMode: modeVal,
          sensitivity: 85,
        },
      });
    })
  );

  const updated = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  return { success: updated > 0, mode: modeName, updated };
}

/** Apply full Cortex mood transition */
export async function syncCortexMoodToLights(apiKey: string, mood: CortexMood, devices?: GoveeDevice[]): Promise<{ success: boolean; mood: string; hex: string }> {
  const meta = CORTEX_MOOD_COLORS[mood] ?? CORTEX_MOOD_COLORS.idle;
  const res = await broadcastColor(apiKey, meta.intVal, devices);
  return { success: res.success, mood, hex: meta.hex };
}

