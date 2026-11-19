/**
 * Vercel serverless TTS proxy — /api/ai/tts
 *
 * Production counterpart of the dev middleware in vite.config.ts
 * (`server.middlewares.use('/api/ai/tts', ttsHandler)`). The SPA rewrite in
 * vercel.json excludes /api/* from the index.html fallback, so this function
 * is what actually serves TTS in production.
 *
 * GET  → health probe: { ok, kokoroConfigured, kokoroDirectOrigin,
 *       kokoroUpstreamReachable? } — never exposes secrets.
 * POST → OpenAI-style speech proxy to Kokoro (:8880 tunnel) with optional
 *        fallback origin; accepts kind=tts_rum beacons (204).
 *
 * Env: KOKORO_TTS_URL (primary), KOKORO_TTS_FALLBACK_URL or
 *      KOKORO_FALLBACK_URL (optional second origin), NO_TTS_URL documented
 *      in the 503 body when no upstream is configured.
 */

const KOKORO_URL = (process.env.KOKORO_TTS_URL || '').replace(/\/+$/, '');
const FALLBACK_URL = (
  process.env.KOKORO_TTS_FALLBACK_URL ||
  process.env.KOKORO_FALLBACK_URL ||
  ''
).replace(/\/+$/, '');

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function probeKokoroHealth(origin: string): Promise<boolean> {
  try {
    const r = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function kokoroUpstreamReachable(): Promise<boolean | null> {
  if (!KOKORO_URL) return null;
  return probeKokoroHealth(KOKORO_URL);
}

async function proxySpeech(origin: string, payload: any): Promise<Response> {
  return fetch(`${origin}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: payload.model || 'kokoro',
      input: payload.input ?? payload.text ?? '',
      voice: payload.voice || 'af_heart',
      speed: typeof payload.speed === 'number' ? Math.max(0.5, Math.min(payload.speed, 2.0)) : 1.0,
    }),
    signal: AbortSignal.timeout(15000),
  });
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const wantsProbe = String(req.query?.probe || '') === '1';
    const body: Record<string, unknown> = {
      ok: true,
      service: 'tts-proxy',
      kokoroConfigured: Boolean(KOKORO_URL),
      kokoroDirectOrigin: KOKORO_URL ? new URL(KOKORO_URL).origin : null,
      fallbackConfigured: Boolean(FALLBACK_URL),
    };
    if (wantsProbe) {
      body.kokoroUpstreamReachable = await kokoroUpstreamReachable();
      if (FALLBACK_URL) body.fallbackUpstreamReachable = await probeKokoroHealth(FALLBACK_URL);
      body.ok = body.kokoroUpstreamReachable === true || body.fallbackUpstreamReachable === true;
    } else {
      body.kokoroUpstreamReachable = null;
    }
    return res.status(200).json(body);
  }

  if (req.method === 'POST') {
    let parsed: any = {};
    try {
      parsed = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch {
      return res.status(400).json({ error: 'invalid JSON body' });
    }

    if (parsed && typeof parsed === 'object' && parsed.kind === 'tts_rum') {
      return res.status(204).end();
    }

    const text = String(parsed.text ?? parsed.input ?? '').trim();
    if (!text) return res.status(400).json({ error: 'text is required' });

    const payload = { ...parsed, input: text };
    const origins = [KOKORO_URL, FALLBACK_URL].filter(Boolean);
    if (origins.length === 0) {
      return res.status(503).json({
        error: 'NO_TTS_URL',
        detail: 'Neither KOKORO_TTS_URL nor KOKORO_TTS_FALLBACK_URL/KOKORO_FALLBACK_URL is configured.',
      });
    }

    let lastStatus = 502;
    for (const origin of origins) {
      try {
        const upstream = await proxySpeech(origin, payload);
        if (upstream.ok) {
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/wav');
          res.setHeader('Content-Length', String(buf.byteLength));
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-TTS-Engine', 'kokoro');
          return res.status(200).send(buf);
        }
        lastStatus = upstream.status;
      } catch {
        // try next origin
      }
    }
    return res.status(lastStatus === 502 ? 502 : lastStatus).json({ error: 'TTS upstream failed' });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
