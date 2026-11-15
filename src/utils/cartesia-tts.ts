/**
 * Cartesia Sonic Neural Voice Client
 * High-definition, ultra-low latency text-to-speech for Conscious AI (Cortex)
 */

export const CARTESIA_VOICES = {
  cortana: {
    id: '2a17e905-8f14-4db7-9b9d-9223a8e3f278', // Jane - Digital Guide
    name: 'Cortana (Halo CE Match — Jane)',
    gender: 'feminine',
    description: 'Crisp, modern, intelligent virtual assistant cadence closest to Halo Combat Evolved Cortana',
  },
  cortana_maia: {
    id: '5a033900-2ed6-4fd4-a257-707f2688e713', // Maia - Agile Support
    name: 'Cortana Tactical (Maia)',
    gender: 'feminine',
    description: 'Prompt, polished voice with crisp articulation and collaborative tactical warmth',
  },
  cortana_evelyn: {
    id: '3c7dfd17-3fa8-47aa-aacc-6313fe025442', // Evelyn - Digital Assistante
    name: 'Cortana Digital (Evelyn)',
    gender: 'feminine',
    description: 'Clear, neutral, precise female voice with a smooth digital AI polish',
  },
  cortana_allie: {
    id: '2747b6cf-fa34-460c-97db-267566918881', // Allie - Natural Conversationalist
    name: 'Cortana Banter (Allie)',
    gender: 'feminine',
    description: 'Confident, approachable young adult tone with quick conversational flow',
  },
  harlow: {
    id: '6c756032-11c3-4be8-a120-74f9673fb700',
    name: 'Harlow (Warm Support)',
    gender: 'feminine',
    description: 'Friendly, warm, and natural conversational cadence',
  },
  jacqueline: {
    id: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
    name: 'Jacqueline (Reassuring & Empathic)',
    gender: 'feminine',
    description: 'Confident, young adult empathic presence',
  },
  gareth: {
    id: '3a01612e-07da-4a85-bba8-ce10481df477',
    name: 'Gareth (Approachable Specialist)',
    gender: 'masculine',
    description: 'Warm and approachable tone for interactive dialogues',
  },
  cillian: {
    id: '15a13943-32a7-49a9-b944-d6062129c5a3',
    name: 'Cillian (Polished & Articulate)',
    gender: 'masculine',
    description: 'Confident, polished presenter tone',
  },
  sonic: {
    id: '79a125e8-cd45-4c13-8a67-188112f4dd22',
    name: 'Sonic (High-Clarity Natural)',
    gender: 'neutral',
    description: 'Crystal-clear articulation with low-latency delivery',
  },
} as const;

export type CartesiaVoiceKey = keyof typeof CARTESIA_VOICES;

export interface CartesiaTtsOptions {
  voiceId?: string | CartesiaVoiceKey;
  model?: string;
  speed?: number;
  apiKey?: string;
}

/** Env-only — the previous hardcoded key was committed to the repo and must be rotated. */
const DEFAULT_CARTESIA_KEY = '';

// Circuit breaker: when Cartesia credits are exhausted (402/quota), every
// call wastes ~1s failing before Kokoro runs. Once detected, skip Cartesia
// entirely for the rest of the session and go straight to the local engine.
let cartesiaExhausted = false;

function isQuotaError(status: number, bodyText?: string): boolean {
  if (status === 402 || status === 429) return true;
  if (bodyText && /credit|quota|subscription|billing/i.test(bodyText)) return true;
  return false;
}

function markExhausted() {
  cartesiaExhausted = true;
  console.warn('[Cartesia TTS] Credits exhausted — circuit breaker OPEN, using Kokoro directly');
}

/**
 * Synthesizes speech using Cartesia Sonic neural voice.
 * Tries local/prod proxy `/api/ai/cartesia-tts` first.
 * Falls back to direct Cartesia API if proxy is unavailable.
 */
export async function fetchCartesiaTtsAudio(
  text: string,
  options: CartesiaTtsOptions = {}
): Promise<Blob | null> {
  const clean = text.trim();
  if (!clean) return null;
  if (cartesiaExhausted) return null;

  const resolvedVoice = (
    options.voiceId && (options.voiceId in CARTESIA_VOICES)
      ? CARTESIA_VOICES[options.voiceId as CartesiaVoiceKey].id
      : options.voiceId || CARTESIA_VOICES.harlow.id
  );

  // 1. Try local/prod proxy
  try {
    const res = await fetch('/api/ai/cartesia-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: clean,
        voiceId: resolvedVoice,
        model: options.model || 'sonic-3.5',
      }),
    });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('audio') || ct.includes('wav')) {
        const blob = await res.blob();
        if (blob.size > 100) return blob;
      }
    } else if (isQuotaError(res.status)) {
      const errText = await res.text().catch(() => '');
      if (isQuotaError(res.status, errText)) {
        markExhausted();
        // Same account/key hits the direct API too — skip the second probe.
        return null;
      }
    }
  } catch (err) {
    console.warn('[Cartesia TTS] Proxy error, attempting direct Cartesia API:', err);
  }

  // 2. Direct fallback (Cartesia officially supports CORS)
  const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CARTESIA_API_KEY) as string | undefined;
  const apiKey = options.apiKey || envKey || DEFAULT_CARTESIA_KEY;

  if (apiKey) {
    try {
      const directRes = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
          'Cartesia-Version': '2024-06-10',
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: options.model || 'sonic-3.5',
          transcript: clean,
          voice: { mode: 'id', id: resolvedVoice },
          output_format: { container: 'wav', sample_rate: 24000, encoding: 'pcm_s16le' },
        }),
      });
      if (directRes.ok) {
        const blob = await directRes.blob();
        if (blob.size > 100) return blob;
      } else if (isQuotaError(directRes.status)) {
        const errText = await directRes.text().catch(() => '');
        if (isQuotaError(directRes.status, errText)) markExhausted();
      }
    } catch (directErr) {
      console.warn('[Cartesia TTS] Direct synthesis failed:', directErr);
    }
  }

  return null;
}
