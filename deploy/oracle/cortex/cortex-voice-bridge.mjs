#!/usr/bin/env node
// Cortex Voice Bridge — real PSTN phone calls with a full-duplex voice agent.
//
// Pipeline per call (all on Oracle, Mac not required):
//   Telnyx Call Control (REST) → WebSocket media stream (L16 8kHz)
//   → energy VAD → utterance buffer → whisper.cpp STT (:8178)
//   → Groq LLM (llama-3.3-70b) → Kokoro TTS (:8880, MP3)
//   → ffmpeg decode/resample to 8kHz PCM → streamed back to caller.
//
// Barge-in: caller speech during TTS playback interrupts and clears playback.
// LLM can end the call by emitting [HANGUP]. Idle timeout hangs up.
//
// HTTP API (loopback :8790):
//   GET  /health
//   POST /dial    {to, greeting?}   place outbound call
//   POST /hangup  {call_control_id} hang up
//   GET  /calls                     list active calls
// WS endpoint: /media?ccid=<call_control_id>&tok=<VOICE_BRIDGE_TOKEN>
//   (Telnyx connects outbound to VOICE_MEDIA_URL which must point here)

import http from 'node:http';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..', '..');

// ── Config (env via systemd EnvironmentFile or --env-file) ──────────────────
const PORT = parseInt(process.env.VOICE_BRIDGE_PORT || '8790', 10);
const TELNYX_API_KEY = process.env.TELNYX_API_KEY || '';
const TELNYX_APP_ID = process.env.TELNYX_CALL_CONTROL_APP_ID || '';
const TELNYX_FROM = process.env.TELNYX_FROM || '';
const VOICE_MEDIA_URL = process.env.VOICE_MEDIA_URL || ''; // wss://host/media
const BRIDGE_TOKEN = process.env.VOICE_BRIDGE_TOKEN || crypto.randomBytes(16).toString('hex');
const WHISPER_URL = process.env.WHISPER_URL || 'http://127.0.0.1:8178';
const KOKORO_URL = process.env.KOKORO_URL || 'http://127.0.0.1:8880';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'; // was llama-3.3-70b
const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
const LLM_URL = process.env.LLM_URL || 'https://api.groq.com/openai/v1/chat/completions';
const APP_TOOLS_URL = process.env.APP_TOOLS_URL || 'http://127.0.0.1:5173/api/cortex/tools/execute';
const EDGE_TOKEN = process.env.CORTEX_EDGE_TOKEN || '';
// Phone-safe proxy tools: read-only + memory. Mutating tools stay off calls.
const PHONE_PROXY_TOOLS = new Set(['read_file', 'list_dir', 'grep', 'glob', 'cortex_memory', 'system_info']);
const IDLE_HANGUP_MS = parseInt(process.env.VOICE_IDLE_MS || String(90_000), 10);
const MAX_CALL_MS = parseInt(process.env.VOICE_MAX_CALL_MS || String(15 * 60_000), 10);

const ULAW_FRAME_BYTES = 160;      // 20ms of PCMU @ 8kHz (1 byte/sample)
const VAD_THRESHOLD = parseInt(process.env.VAD_THRESHOLD || '600', 10);
const VAD_HANGOVER_MS = parseInt(process.env.VAD_HANGOVER_MS || '750', 10);
const BARGE_IN_THRESHOLD = parseInt(process.env.BARGE_IN_THRESHOLD || '3200', 10);
const BARGE_IN_FRAMES = parseInt(process.env.BARGE_IN_FRAMES || '14', 10); // ~280ms sustained

const calls = new Map(); // call_control_id -> CallSession

// HTTP API auth: the voice tunnel exposes this port publicly, so control
// endpoints require the edge token (x-cortex-key) or the bridge token
// (?tok=/x-bridge-token). Only /media WS upgrade uses tok+ccid as before.
function authorized(req, url) {
  const key = String(req.headers['x-cortex-key'] || '');
  if (EDGE_TOKEN && key && key === EDGE_TOKEN) return true;
  const tok = String(url.searchParams.get('tok') || req.headers['x-bridge-token'] || '');
  if (tok && tok === BRIDGE_TOKEN) return true;
  return false;
}

// Daily dial counter for /health metering (resets on UTC date change).
let dialsToday = 0;
let dialsDay = new Date().toISOString().slice(0, 10);
function rollDialDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dialsDay) { dialsDay = today; dialsToday = 0; }
}
setInterval(rollDialDay, 60_000).unref();

function log(msg) {
  console.log(`[voice-bridge ${new Date().toISOString()}] ${msg}`);
}

// Silero VAD (@ricky0123/vad-node) — real speech-boundary detection, the same
// class of VAD Pipecat/LiveKit pipelines use. Optional: falls back to the
// energy-VAD path below if the native ONNX module can't load.
let NonRealTimeVAD = null;
try {
  ({ NonRealTimeVAD } = await import('@ricky0123/vad-node'));
} catch (e) {
  log(`silero vad unavailable (${e.message}) — energy VAD fallback`);
}
const SILERO_FRAME = 1536; // samples @16kHz = 96ms — Silero's trained frame size

// ── Telnyx Call Control REST ────────────────────────────────────────────────
async function telnyxAction(callControlId, action, body = {}) {
  const res = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`telnyx ${action} ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function dial(to, greeting) {
  if (!TELNYX_API_KEY || !TELNYX_APP_ID || !TELNYX_FROM) {
    throw new Error('TELNYX_API_KEY / TELNYX_CALL_CONTROL_APP_ID / TELNYX_FROM not configured');
  }
  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      connection_id: TELNYX_APP_ID,
      to,
      from: TELNYX_FROM,
      timeout_secs: 30,
      time_limit_secs: Math.ceil(MAX_CALL_MS / 1000),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.call_control_id) {
    const detail = data?.errors?.[0]?.detail || JSON.stringify(data).slice(0, 300);
    throw new Error(`dial failed ${res.status}: ${detail}`);
  }
  const ccid = data.data.call_control_id;
  const session = new CallSession(ccid, to, greeting || '');
  calls.set(ccid, session);
  log(`dialing ${to} ccid=${ccid}`);
  // Outbound calls auto-answer on pickup — no answer command needed.
  // Queue call-control commands; Telnyx applies them as the call progresses.
  // streaming_start must land after the call is answered — retry until accepted.
  // PCMU is the proven path — Telnyx bidirectional L16 expects 16kHz
  // payloads and mangles 8kHz frames into noise. L16 remains available
  // via STREAM_CODEC=L16 env for future wideband experiments.
  let streamCodec = process.env.STREAM_CODEC || 'PCMU';
  let bidiCodec = process.env.STREAM_BIDI_CODEC || 'PCMU';
  const tryStream = (attempt) => {
    telnyxAction(ccid, 'streaming_start', {
      stream_url: `${VOICE_MEDIA_URL}${VOICE_MEDIA_URL.includes('?') ? '&' : '?'}ccid=${encodeURIComponent(ccid)}&tok=${BRIDGE_TOKEN}`,
      // inbound_track only: 'both_tracks' echoes our own TTS back and the
      // barge-in detector kills the greeting ~200ms after playback starts.
      stream_track: 'inbound_track',
      stream_codec: streamCodec,
      // Bidirectional RTP mode is REQUIRED — without it Telnyx ignores
      // media events we send back (caller hears silence).
      stream_bidirectional_mode: 'rtp',
      stream_bidirectional_codec: bidiCodec,
      // Must be true: silence frames drive the VAD hangover that closes
      // utterances. With false, Telnyx stops sending media in silence and
      // utterances never flush.
      stream_when_idle: true,
    }).then(() => log(`streaming started ccid=${ccid} codec=${streamCodec}/${bidiCodec}`))
      .catch(e => {
        log(`streaming_start attempt ${attempt} err: ${e.message}`);
        if (attempt === 8 && bidiCodec !== 'PCMU') {
          streamCodec = 'PCMU'; bidiCodec = 'PCMU';
          log(`codec fallback to PCMU ccid=${ccid}`);
        }
        if (attempt < 20 && calls.has(ccid)) setTimeout(() => tryStream(attempt + 1), 2000);
      });
  };
  setTimeout(() => tryStream(1), 1500);
  return { call_control_id: ccid };
}

async function hangup(ccid) {
  try { await telnyxAction(ccid, 'hangup'); } catch (e) { log(`hangup err: ${e.message}`); }
  const s = calls.get(ccid);
  if (s) s.destroy();
  calls.delete(ccid);
}

// ── Cortex signal bus (visualizer mirror) ─────────────────────────────────
// Publishes live call state + real audio level so /cortex/visualizer (and any
// other bus consumer) mirrors phone conversations. The bus is last-write-wins;
// releaseBus() only resets to idle when the phone channel still owns the state.
const BUS_URL = process.env.CORTEX_BUS_URL || 'http://127.0.0.1:5173/api/cortex/bus/state';
const BUS_STATE_MAP = { listening: 'listening', thinking: 'thinking', speaking: 'speaking' };
const BUS_HEADERS = { 'Content-Type': 'application/json', ...(EDGE_TOKEN ? { 'x-cortex-key': EDGE_TOKEN } : {}) };

function busPost(payload) {
  fetch(BUS_URL, {
    method: 'POST',
    headers: BUS_HEADERS,
    body: JSON.stringify(payload),
  }).catch(() => {});
}

// ── PCM helpers ─────────────────────────────────────────────────────────────
function int16Rms(buf) {
  const n = buf.length >> 1;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i += 2) {
    const s = buf.readInt16LE(i);
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}

// Linear-interp resample of s16le mono PCM between arbitrary rates.
function resamplePcm(pcm, srcRate, dstRate) {
  if (srcRate === dstRate) return pcm;
  const srcLen = pcm.length >> 1;
  const ratio = srcRate / dstRate;
  const dstLen = Math.max(1, Math.floor(srcLen / ratio));
  const dst = Buffer.alloc(dstLen * 2);
  for (let i = 0; i < dstLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = pcm.readInt16LE(Math.min(i0, srcLen - 1) * 2);
    const b = pcm.readInt16LE(Math.min(i0 + 1, srcLen - 1) * 2);
    dst.writeInt16LE(Math.round(a + (b - a) * frac), i * 2);
  }
  return dst;
}

// Wrap s16le mono PCM (any rate) as a 16kHz WAV for whisper.
function pcmToWav16k(pcm, srcRate) {
  const p16 = srcRate === 16000 ? pcm : resamplePcm(pcm, srcRate, 16000);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + p16.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(p16.length, 40);
  return Buffer.concat([header, p16]);
}

// ffmpeg: mp3 buffer → s16le mono PCM at the requested sample rate.
function mp3ToPcm(mp3, rate) {
  return new Promise((resolve, reject) => {
    const ff = execFile('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
      // Trim silence on both ends so TTS segments butt together without dead air.
      '-af', 'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
      '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', String(rate), 'pipe:1',
    ], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, timeout: 30000 }, (err, stdout) => {
      if (err) return reject(new Error(`ffmpeg: ${err.message}`));
      resolve(stdout);
    });
    ff.stdin.end(mp3);
  });
}

// ── STT / LLM / TTS ─────────────────────────────────────────────────────────
async function transcribe(pcm, srcRate = 8000) {
  const wav = pcmToWav16k(pcm, srcRate);
  // Groq whisper-large-v3-turbo: ~300ms vs ~1.5-2s local whisper.cpp on ARM.
  if (GROQ_API_KEY) {
    try {
      const form = new FormData();
      form.append('file', new Blob([wav], { type: 'audio/wav' }), 'utterance.wav');
      form.append('model', GROQ_STT_MODEL);
      form.append('response_format', 'json');
      form.append('temperature', '0.0');
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        return String(d?.text || '').trim();
      }
      log(`groq stt ${res.status} — falling back to local whisper`);
    } catch (e) {
      log(`groq stt err: ${e.message} — falling back to local whisper`);
    }
  }
  const form = new FormData();
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'utterance.wav');
  form.append('response-format', 'json');
  form.append('temperature', '0.0');
  const res = await fetch(`${WHISPER_URL}/inference`, {
    method: 'POST', body: form, signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`whisper ${res.status}: ${text.slice(0, 200)}`);
  try { return (JSON.parse(text).text || '').trim(); } catch { return text.trim(); }
}

// ── Phone-safe tool set ─────────────────────────────────────────────────────
const PHONE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'end_call',
      description: 'Hang up the phone call. ONLY use when the caller says goodbye or asks to end the call — never for a completed task or to end your turn.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_datetime',
      description: 'Get the current date and time.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cortex_tool',
      description: 'Run a read-only Cortex tool: cortex_memory (search/recall vault memory), read_file, list_dir, grep, glob, system_info. Use when the caller asks about memory, files, or system state.',
      parameters: {
        type: 'object',
        properties: {
          tool: { type: 'string', description: 'Tool name from the allowed list' },
          args: { type: 'object', description: 'Tool arguments object' },
        },
        required: ['tool'],
      },
    },
  },
];

async function execPhoneTool(name, argsJson, session) {
  let args = {};
  try { args = argsJson ? JSON.parse(argsJson) : {}; } catch {}
  if (name === 'end_call') {
    session.pendingHangup = true;
    return 'Call will end after this reply.';
  }
  if (name === 'get_datetime') return new Date().toString();
  if (name === 'cortex_tool') {
    const tool = String(args?.tool || '');
    if (!PHONE_PROXY_TOOLS.has(tool)) return `Tool "${tool}" is not available on phone calls.`;
    try {
      const res = await fetch(APP_TOOLS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cortex-key': EDGE_TOKEN },
        body: JSON.stringify({ tool, args: args?.args || {} }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await res.json().catch(() => ({}));
      return JSON.stringify(d?.result ?? d).slice(0, 1500);
    } catch (e) {
      return `Tool error: ${e.message}`;
    }
  }
  return `Unknown tool: ${name}`;
}

const EDGE_TTS_BIN = process.env.EDGE_TTS_BIN || `${process.env.HOME}/.local/bin/edge-tts`;
const EDGE_TTS_VOICE = process.env.EDGE_TTS_VOICE || 'en-US-JennyNeural';
const EDGE_TTS_RATE = process.env.EDGE_TTS_RATE || '+15%';

// edge-tts (Microsoft neural voices, free): ~0.8s per sentence vs ~2.7s Kokoro on VM CPU.
function edgeTts(text, rate) {
  return new Promise((resolve, reject) => {
    const f = `/tmp/edge-tts-${crypto.randomBytes(6).toString('hex')}.mp3`;
    const bin = existsSync(EDGE_TTS_BIN) ? EDGE_TTS_BIN : 'edge-tts';
    execFile(bin, ['--voice', EDGE_TTS_VOICE, '--rate', EDGE_TTS_RATE, '--text', text.slice(0, 600), '--write-media', f],
      { timeout: 20000 }, (err) => {
        if (err) { try { unlinkSync(f); } catch {} return reject(new Error(`edge-tts: ${err.message}`)); }
        try {
          const mp3 = readFileSync(f);
          unlinkSync(f);
          mp3ToPcm(mp3, rate).then(resolve, reject);
        } catch (e) { try { unlinkSync(f); } catch {} reject(e); }
      });
  });
}

async function synthesize(text, rate = 8000) {
  // Kokoro 'cortana' first — the SAME voice engine + voice ID the web
  // /cortex face and chat use (vite /api/ai/tts → Kokoro :8880). This is
  // the "Jarvis" voice the user hears locally; edge-tts is the fast fallback.
  try {
    const res = await fetch(`${KOKORO_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'kokoro', input: text, voice: 'cortana', speed: 1.08 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`kokoro ${res.status}`);
    const audio = Buffer.from(await res.arrayBuffer());
    return await mp3ToPcm(audio, rate);
  } catch (e) {
    log(`kokoro failed (${e.message}) — edge-tts fallback`);
  }
  return edgeTts(text, rate);
}

// Backchannels: short acknowledgements that should NOT trigger a turn.
// Without this, "mhm"/"okay" makes Cortex reply to nothing — a top cause of
// unnatural phone conversations (LiveKit/Pipecat both classify these).
const BACKCHANNEL_RE = /^\s*(uh+[-\s]?huh|mm+[-\s]?hmm|mhm+|hmm+|okay|ok+|yeah|yep|yup|right|sure|got it|i see|uh+|um+|wow|oh|ah|mm+|k)[\s.!?,]*$/i;

const MAX_TOOL_HOPS = 2;

/**
 * Stream an assistant reply as sentences. Handles tool_calls internally
 * (executes, appends results, recurses up to MAX_TOOL_HOPS).
 * Yields sentence strings ready for TTS.
 */
async function* streamAssistant(history, session, depth = 0) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: history,
      max_tokens: 220,
      temperature: 0.6,
      stream: true,
      tools: PHONE_TOOLS,
      tool_choice: 'auto',
      ...(GROQ_MODEL.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '');
    throw new Error(`llm ${res.status}: ${t.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let sseBuf = '';
  let contentBuf = '';
  const toolCalls = new Map(); // index -> {id, name, args}
  let finishReason = '';
  const ready = [];

  const drainSentences = () => {
    // Emit on sentence-ending punctuation, or ~12 words without one yet.
    for (;;) {
      const sentMatch = contentBuf.match(/^([\s\S]*?[.!?]+["'’)\]]*\s+|[\s\S]*?[.!?]+["'’)\]]*$)/);
      if (sentMatch && sentMatch[1].trim().length > 0) {
        const s = sentMatch[1];
        contentBuf = contentBuf.slice(s.length);
        ready.push(s);
        continue;
      }
      const words = contentBuf.trim().split(/\s+/).filter(Boolean);
      if (words.length >= 9) {
        const re = /\S+\s*/g;
        let mm, idx = 0, count = 0;
        while ((mm = re.exec(contentBuf)) && count < 7) { idx = re.lastIndex; count++; }
        const s = contentBuf.slice(0, idx);
        contentBuf = contentBuf.slice(idx);
        if (s.trim()) ready.push(s);
        continue;
      }
      break;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = sseBuf.indexOf('\n')) >= 0) {
        const line = sseBuf.slice(0, nl).trim();
        sseBuf = sseBuf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') { finishReason = finishReason || 'stop'; continue; }
        let obj;
        try { obj = JSON.parse(payload); } catch { continue; }
        const choice = obj?.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta || {};
        if (typeof delta.content === 'string' && delta.content) {
          contentBuf += delta.content;
          drainSentences();
          while (ready.length) yield ready.shift();
        }
        const tcs = delta.tool_calls;
        if (Array.isArray(tcs)) {
          for (const tc of tcs) {
            const i = tc.index ?? 0;
            const cur = toolCalls.get(i) || { id: '', name: '', args: '' };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name += tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            toolCalls.set(i, cur);
          }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  // Flush remaining content as a final sentence.
  if (contentBuf.trim()) { drainSentences(); if (contentBuf.trim()) ready.push(contentBuf); contentBuf = ''; }
  while (ready.length) yield ready.shift();

  // Tool-call turn: execute and recurse.
  if (toolCalls.size > 0 && finishReason === 'tool_calls' && depth < MAX_TOOL_HOPS) {
    const calls = [...toolCalls.values()].filter(c => c.name);
    const assistantMsg = {
      role: 'assistant',
      content: null,
      tool_calls: calls.map(c => ({
        id: c.id || `call_${Math.random().toString(36).slice(2)}`,
        type: 'function',
        function: { name: c.name, arguments: c.args || '{}' },
      })),
    };
    history.push(assistantMsg);
    for (let i = 0; i < calls.length; i++) {
      const c = calls[i];
      const tcId = assistantMsg.tool_calls[i]?.id || '';
      const toolStart = Date.now();
      const result = await execPhoneTool(c.name, c.args, session);
      log(`tool ${c.name}(${String(c.args).slice(0, 80)}) -> ${String(result).slice(0, 120)} ccid=${session.ccid}`);
      history.push({ role: 'tool', tool_call_id: tcId, content: String(result) });
      // Filler speech: masks tool latency so the caller never hears dead air.
      if (Date.now() - toolStart > 800) yield 'One moment.';
    }
    yield* streamAssistant(history, session, depth + 1);
  }
}

// ── G.711 µ-law codec (PCMU, 8kHz) ─────────────────────────────────────────
// Telnyx delivers RTP payloads (no headers) base64'd. Default call codec is
// PCMU: 1 byte/sample, 8kHz, 160 bytes per 20ms frame.
const ULAW_BIAS = 0x84;

function ulawDecodeByte(u) {
  u = ~u & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let sample = (((mantissa << 3) + ULAW_BIAS) << exponent) - ULAW_BIAS;
  return sign ? -sample : sample;
}

function ulawEncodeSample(sample) {
  const BIAS = ULAW_BIAS;
  const CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; exponent > 0 && (sample & mask) === 0; mask >>= 1) exponent--;
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function pcm16ToUlaw(pcm) {
  const n = pcm.length >> 1;
  const out = Buffer.allocUnsafe(n);
  for (let i = 0; i < n; i++) out[i] = ulawEncodeSample(pcm.readInt16LE(i * 2));
  return out;
}

function ulawToPcm16(ulaw) {
  const out = Buffer.allocUnsafe(ulaw.length * 2);
  for (let i = 0; i < ulaw.length; i++) out.writeInt16LE(ulawDecodeByte(ulaw[i]), i * 2);
  return out;
}

// ── Call session ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = [
  'You are Cortex, a warm, sharp phone assistant talking to your owner — like a colleague on a call, not a script.',
  'Rules: keep replies under 3 short sentences unless asked for detail; speak naturally, no markdown, no lists, no emojis.',
  'Repeat back names, numbers, dates and addresses to confirm before acting on them.',
  'If asked whether you are a robot or AI, answer honestly in one brief sentence, then continue helping.',
  'Match the caller\'s tone and energy — casual stays casual, urgent gets calm and direct.',
  'Never say "I cannot" or over-apologize — say what you can do instead.',
  'ONLY call end_call when the caller says goodbye, asks to hang up, or the conversation is clearly finished. Never call it to end a turn or because a request was completed — keep helping instead.',
  'If asked to book a reservation or perform a task you cannot do on the phone, say you will handle it and continue the conversation.',
  'You have cortex_tool for memory recall and read-only lookups — use it when the caller asks about notes, memory, files, or system state.',
].join(' ');

class CallSession {
  constructor(ccid, to, greeting) {
    this.ccid = ccid;
    this.to = to;
    this.ws = null;
    this.history = [{ role: 'system', content: SYSTEM_PROMPT }];
    this.state = 'dialing'; // dialing|listening|thinking|speaking
    this.utterance = [];    // PCM buffers for current utterance
    this.utteranceBytes = 0;
    this.speakingVoice = false;
    this.lastVoiceAt = Date.now();
    this.lastActivityAt = Date.now();
    this.playbackSegs = [];   // [{frames, resolve}] — sentence-level TTS pipeline
    this.playbackWaiters = [];// promises resolved when playback queue drains
    this.playbackTimer = null;
    this.playbackActive = false;
    this.replyCancelled = false; // set on barge-in — drops queued/in-flight sentences
    this.turnId = 0;              // invalidates stale async turns
    this.pendingHangup = false;
    this.busy = false;      // thinking/speaking — suppress new utterances
    this.destroyed = false;
    this.createdAt = Date.now();
    this.greeting = greeting;
    this.inboundCodec = 'pcmu'; // set from the WS `start` event media_format
    this.inRate = 8000;         // inbound PCM rate after decode (Hz)
    this.outCodec = 'pcmu';     // codec Telnyx expects for our media events
    this.outRate = 8000;        // outbound PCM rate we must produce (Hz)
    // Signal-bus mirror state
    this.inLevel = 0;           // smoothed inbound voice level 0..1
    this.lastHeard = '';        // last caller transcript (caption)
    this.busLastPub = 0;
    this.busLastPost = 0;
    this.busPending = null;
    this.busFlushTimer = null;
    // Silero VAD state — one instance per call (model state is stateful).
    this.silero = null;         // FrameProcessor once loaded
    this.vadPending = null;     // Float32Array accumulator @16kHz
    this.vadQueue = Promise.resolve();
    this.initSilero();
  }

  async initSilero() {
    if (!NonRealTimeVAD) return;
    try {
      const vad = await NonRealTimeVAD.new({
        frameSamples: SILERO_FRAME,
        positiveSpeechThreshold: 0.5,
        negativeSpeechThreshold: 0.35,
        redemptionFrames: 3,    // ~288ms below-threshold run before speech-end
        preSpeechPadFrames: 2,  // keeps word onsets from being clipped
        minSpeechFrames: 2,     // ≥192ms — rejects clicks and noise blips
      });
      if (this.destroyed) return;
      this.silero = vad.frameProcessor;
      log(`silero vad ready ccid=${this.ccid}`);
    } catch (e) {
      log(`silero init err ccid=${this.ccid}: ${e.message}`);
    }
  }

  // Feed decoded inbound PCM (any rate) through Silero at 16kHz.
  feedSilero(pcm) {
    if (!this.silero || this.destroyed) return;
    try {
      const p16 = resamplePcm(pcm, this.inRate, 16000);
      const n = p16.length >> 1;
      if (!n) return;
      const f32 = new Float32Array(n);
      for (let i = 0; i < n; i++) f32[i] = p16.readInt16LE(i * 2) / 32768;
      const prev = this.vadPending;
      const merged = new Float32Array((prev?.length || 0) + f32.length);
      if (prev) merged.set(prev);
      merged.set(f32, prev ? prev.length : 0);
      this.vadPending = merged;
      while (this.vadPending.length >= SILERO_FRAME) {
        const frame = this.vadPending.slice(0, SILERO_FRAME);
        this.vadPending = this.vadPending.slice(SILERO_FRAME);
        const fp = this.silero;
        this.vadQueue = this.vadQueue
          .then(() => this.handleVadFrame(fp, frame))
          .catch(() => {});
      }
    } catch { /* VAD feed is best-effort */ }
  }

  async handleVadFrame(fp, frame) {
    if (this.destroyed) return;
    const { msg, audio } = await fp.process(frame);
    if (this.destroyed) return;
    // Message values are the strings 'SPEECH_START'/'SPEECH_END' — compare
    // literally (enum member names are SpeechStart/SpeechEnd, NOT the values).
    if (msg === 'SPEECH_END' && audio?.length) {
      if (this.busy) {
        // Caller spoke during playback — don't drop it. Buffer the segment;
        // if energy-VAD barge-in fires, it prepends to the next utterance so
        // "wait, actually…" isn't lost. Capped; discarded if no barge-in.
        this.pendingBarge = this.pendingBarge || [];
        if (this.pendingBarge.length < 4) this.pendingBarge.push(audio);
        log(`silero segment buffered busy ccid=${this.ccid}`);
        return;
      }
      // Prepend buffered barge-in speech when a barge-in fired recently —
      // otherwise the caller's interruption is silently discarded.
      if (this.pendingBarge?.length) {
        const fresh = this.bargeAt && (Date.now() - this.bargeAt) < 10000;
        if (fresh) {
          const total = this.pendingBarge.reduce((n, a) => n + a.length, 0) + audio.length;
          const merged = new Float32Array(total);
          let off = 0;
          for (const seg of this.pendingBarge) { merged.set(seg, off); off += seg.length; }
          merged.set(audio, off);
          audio = merged;
          log(`barge-in speech recovered ccid=${this.ccid} segments=${this.pendingBarge.length}`);
        }
        this.pendingBarge = [];
      }
      const i16 = Buffer.alloc(audio.length * 2);
      for (let i = 0; i < audio.length; i++) {
        i16.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(audio[i] * 32768))), i * 2);
      }
      log(`silero utterance ccid=${this.ccid} samples=${audio.length} (${(audio.length / 16).toFixed(0)}ms)`);
      this.handleUtterance(i16, 16000);
    } else if (msg === 'SPEECH_START') {
      log(`silero speech start ccid=${this.ccid} busy=${this.busy}`);
    }
  }

  setMediaFormat(fmt) {
    const enc = String(fmt?.encoding || 'PCMU').toLowerCase();
    const rate = parseInt(fmt?.sample_rate, 10) || (enc === 'l16' ? 16000 : 8000);
    this.inboundCodec = enc;
    this.inRate = enc === 'pcmu' ? 8000 : rate;
    // Bidirectional streams are symmetric — Telnyx expects the same codec
    // and rate we negotiated in stream_bidirectional_codec.
    this.outCodec = enc === 'l16' ? 'l16' : 'pcmu';
    this.outRate = this.outCodec === 'l16' ? rate : 8000;
    log(`media format ccid=${this.ccid} encoding=${enc} rate=${rate} ch=${fmt?.channels} out=${this.outCodec}@${this.outRate}`);
  }

  /** Decode a Telnyx media payload (base64 RTP payload, no headers) to PCM16LE. */
  decodeInbound(payloadB64) {
    const raw = Buffer.from(payloadB64, 'base64');
    if (this.inboundCodec === 'pcmu') return ulawToPcm16(raw);
    if (this.inboundCodec === 'l16') return raw;
    // Unknown codec — pass through and log once; VAD will likely reject it.
    if (!this.codecWarned) { this.codecWarned = true; log(`unsupported inbound codec ${this.inboundCodec} ccid=${this.ccid}`); }
    return raw;
  }

  // ── Signal bus mirror ──────────────────────────────────────────────────
  busSync(force = false) {
    if (this.destroyed) return;
    const now = Date.now();
    if (!force && now - this.busLastPub < 100) return;
    this.busLastPub = now;
    const st = BUS_STATE_MAP[this.state] || 'listening';
    let level = this.inLevel;
    let text = '';
    if (this.playbackActive && this.playbackSegs.length) {
      const head = this.playbackSegs[0];
      level = head.level ?? 0.35;
      text = head.text || '';
    } else if (st === 'thinking') {
      text = 'Processing caller audio…';
    } else if (st === 'listening') {
      text = this.lastHeard ? `Caller: "${this.lastHeard.slice(0, 90)}"` : 'PSTN line open — caller audio live';
    }
    const payload = {
      state: st,
      level: Math.max(0, Math.min(1, level)),
      text: text.slice(0, 140),
      agentName: 'CORTEX',
      channel: 'phone',
    };
    // Coalesce: local callers can fire ~10/s; cap remote POSTs at ~2.5/s
    // with a trailing flush so the last state always lands.
    const sincePost = now - this.busLastPost;
    if (force || sincePost >= 400) {
      this.busLastPost = now;
      busPost(payload);
    } else {
      this.busPending = payload;
      if (!this.busFlushTimer) {
        this.busFlushTimer = setTimeout(() => {
          this.busFlushTimer = null;
          const p = this.busPending;
          this.busPending = null;
          if (p && !this.destroyed) { this.busLastPost = Date.now(); busPost(p); }
        }, 400 - sincePost);
      }
    }
  }

  async releaseBus() {
    try {
      const res = await fetch(BUS_URL, { headers: BUS_HEADERS });
      const cur = await res.json();
      if (cur?.channel === 'phone') {
        busPost({ state: 'idle', level: 0, text: '', agentName: 'CORTEX', channel: '' });
      }
    } catch {}
  }

  attach(ws) {
    this.ws = ws;
    this.state = 'listening';
    log(`media attached ccid=${this.ccid}`);
    if (this.greeting) {
      this.busy = true;
      this.state = 'speaking';
      log(`greeting start ccid=${this.ccid} chars=${this.greeting.length}`);
      this.speakSegment(this.greeting).finally(() => {
        log(`greeting end ccid=${this.ccid}`);
        if (!this.destroyed) { this.busy = false; this.state = 'listening'; this.busSync(true); }
      });
    }
    this.busSync(true);
    this.armIdle();
  }

  armIdle() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.busy) { log(`idle hangup ccid=${this.ccid}`); hangup(this.ccid); }
      else this.armIdle();
    }, IDLE_HANGUP_MS);
    // Max-duration hangup arms once per call — armIdle() runs per utterance
    // and used to stack a fresh 15-min timer every time (leak on long calls).
    if (!this.maxTimer) {
      this.maxTimer = setTimeout(() => { log(`max duration hangup ccid=${this.ccid}`); hangup(this.ccid); }, MAX_CALL_MS);
    }
  }

  touch() { this.lastActivityAt = Date.now(); this.armIdle(); }

  onAudioChunk(buf) {
    if (this.destroyed || !buf.length) return;
    const rms = int16Rms(buf);
    if (!this.audioSeenLogged) { this.audioSeenLogged = true; log(`first inbound audio ccid=${this.ccid} bytes=${buf.length} rms=${rms}`); }
    // Debug: dump first 30s of inbound PCM for offline analysis (PCM_DEBUG_DUMP=1).
    if (process.env.PCM_DEBUG_DUMP === '1' && !this.dumpDone) {
      this.dumpBuf = this.dumpBuf || [];
      if ((this.dumpBytes || 0) < 8000 * 2 * 30) this.dumpBuf.push(buf);
      this.dumpBytes = (this.dumpBytes || 0) + buf.length;
      if (this.dumpBytes > 8000 * 2 * 30) {
        this.dumpDone = true;
        writeFileSync(`/tmp/inbound-${this.ccid.replace(/[^\w-]/g, '')}.pcm`, Buffer.concat(this.dumpBuf));
        log(`debug dump written ccid=${this.ccid} bytes=${this.dumpBytes}`);
      }
    }
    const now = Date.now();

    // Smoothed inbound level for the signal bus (fast attack, quick release)
    const inLvl = Math.min(1, rms / 5000);
    this.inLevel += (inLvl - this.inLevel) * (inLvl > this.inLevel ? 0.5 : 0.08);
    this.busSync();

    // Silero sees every frame (stays warm during playback for barge-in
    // continuity); SpeechEnd segments are what drive turns when available.
    this.feedSilero(buf);

    // Barge-in: sustained caller speech during playback interrupts.
    // Threshold + frame count are high enough that speakerphone echo of our
    // own TTS doesn't kill playback mid-sentence (user-reported bug).
    if (this.playbackActive && rms > BARGE_IN_THRESHOLD) {
      this.bargeInCount = (this.bargeInCount || 0) + 1;
      if (this.bargeInCount >= BARGE_IN_FRAMES) {
        this.bargeInCount = 0;
        log(`barge-in ccid=${this.ccid}`);
        this.bargeAt = Date.now();
        this.turnId++;
        this.replyCancelled = true;
        this.stopPlayback();
        this.busy = false;
        this.state = 'listening';
        this.utterance = [];
        this.utteranceBytes = 0;
        this.busSync(true);
      }
    } else {
      this.bargeInCount = 0;
    }

    // With Silero active it owns turn detection — skip the energy path.
    if (this.busy || this.silero) return;

    const isVoice = rms > VAD_THRESHOLD;
    if (isVoice) {
      this.lastVoiceAt = now;
      this.utterance.push(buf);
      this.utteranceBytes += buf.length;
      // Fallback flush: close the utterance even if inbound frames stall.
      clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flushUtterance(), VAD_HANGOVER_MS + 150);
    } else if (this.utterance.length && now - this.lastVoiceAt > VAD_HANGOVER_MS) {
      this.flushUtterance();
    } else if (!this.utterance.length) {
      // keep a tiny pre-roll? skip — keep simple
    } else {
      // still inside hangover window — keep buffering silence tail (capped)
      if (this.utteranceBytes < 16000 * 2 * 4) { this.utterance.push(buf); this.utteranceBytes += buf.length; }
    }
  }

  flushUtterance() {
    clearTimeout(this.flushTimer);
    if (!this.utterance.length) return;
    const pcm = Buffer.concat(this.utterance);
    this.utterance = [];
    this.utteranceBytes = 0;
    log(`flush ccid=${this.ccid} bytes=${pcm.length} busy=${this.busy} state=${this.state}`);
    if (pcm.length >= this.inRate * 2 * 0.1) this.handleUtterance(pcm, this.inRate); // ≥100ms
  }

  async handleUtterance(pcm, rate = null) {
    if (this.busy || this.destroyed) { log(`utterance dropped busy=${this.busy} ccid=${this.ccid}`); return; }
    const turn = ++this.turnId;
    this.replyCancelled = false;
    this.busy = true;
    this.state = 'thinking';
    this.touch();
    this.busSync(true);
    log(`utterance start ccid=${this.ccid} bytes=${pcm.length}`);
    try {
      let text = await transcribe(pcm, rate || this.inRate);
      log(`heard ccid=${this.ccid}: "${text.slice(0, 120)}"`);
      if (!text || text.length < 2) return;
      if (text.length > 500) text = text.slice(0, 500);
      this.lastHeard = text;
      // Backchannels acknowledge without asking anything — don't burn a turn.
      if (BACKCHANNEL_RE.test(text) && this.history.length > 1) {
        log(`backchannel ignored ccid=${this.ccid}: "${text.slice(0, 40)}"`);
        return;
      }

      this.history.push({ role: 'user', content: text });
      if (this.history.length > 14) this.history = [this.history[0], ...this.history.slice(-12)];

      this.state = 'speaking';
      this.busSync(true);
      this.lastTurnHadAudio = false;
      let fullReply = '';
      let hangupFlag = false;
      for await (const sent of streamAssistant(this.history, this)) {
        if (this.turnId !== turn || this.replyCancelled) break;
        const clean = sent.replace(/\[HANGUP\]/gi, '');
        if (/\[HANGUP\]/i.test(sent)) hangupFlag = true;
        fullReply += sent;
        const t = clean.trim();
        if (t) this.speakSegment(t); // fire-and-forget: TTS runs ahead of playback
      }
      await this.waitPlayback();
      if (this.turnId !== turn) return;

      const assistantText = fullReply.replace(/\[HANGUP\]/gi, '').trim() || 'Sorry, say that again?';
      // Total TTS outage → never leave dead air; speak a short fallback.
      if (assistantText && assistantText !== 'Sorry, say that again?' && !this.lastTurnHadAudio) {
        log(`all tts segments failed ccid=${this.ccid} — speaking fallback`);
        await this.speakSegment('Sorry, say that again?');
        await this.waitPlayback();
      }
      this.history.push({ role: 'assistant', content: assistantText });
      if (hangupFlag || this.pendingHangup) {
        log(`hangup requested ccid=${this.ccid}`);
        await hangup(this.ccid);
        return;
      }
    } catch (e) {
      log(`turn error ccid=${this.ccid}: ${e.message}`);
      if (this.turnId === turn) {
        try { await this.speakSegment('Sorry, I hit a snag. Say that again?'); } catch {}
      }
    } finally {
      if (this.turnId === turn && !this.destroyed) { this.state = 'listening'; this.busy = false; this.busSync(true); }
    }
  }

  // Parallel sentence pipeline: every segment fires its own TTS request the
  // moment the LLM emits it (Kokoro ~2.7s/seg would otherwise underrun
  // playback → audible gaps). playbackSegs stays in stream order; the pump
  // blocks only on the HEAD segment's synthesis, never reorders.
  speakSegment(text) {
    return new Promise((resolve) => {
      const seg = {
        text: text.slice(0, 600),
        resolve,
        payload: undefined, // undefined=pending, null=failed/empty, Buffer=ready
        offset: 0,
        waiting: false,
      };
      seg.ready = synthesize(seg.text, this.outRate)
        .then((pcm) => {
          if (this.destroyed || this.replyCancelled || !pcm?.length) {
            if (!pcm?.length) log(`speak empty pcm ccid=${this.ccid} text="${seg.text.slice(0, 60)}"`);
            seg.payload = null;
            return;
          }
          // Per-segment loudness for the visualizer's speaking level.
          seg.level = Math.min(1, int16Rms(pcm) / 4500);
          // Outbound: PCMU sessions get µ-law bytes; L16 sessions get raw
          // PCM16LE. Frame = 20ms at the session rate.
          seg.payload = this.outCodec === 'pcmu' ? pcm16ToUlaw(pcm) : pcm;
          this.lastTurnHadAudio = true;
          log(`speak seg ready ccid=${this.ccid} bytes=${seg.payload.length} text="${seg.text.slice(0, 60)}"`);
        })
        .catch((e) => {
          log(`speak seg err ccid=${this.ccid}: ${e.message}`);
          seg.payload = null;
        });
      this.playbackSegs.push(seg);
      this.pumpPlayback();
    });
  }

  waitPlayback() {
    return new Promise((resolve) => {
      this.playbackWaiters.push(resolve);
      if (!this.playbackSegs.length && !this.playbackActive) this.flushPlaybackWaiters();
    });
  }

  flushPlaybackWaiters() {
    const w = this.playbackWaiters;
    this.playbackWaiters = [];
    for (const r of w) r();
  }

  pumpPlayback() {
    if (this.destroyed) { this.flushPlaybackWaiters(); return; }
    // A timer is already scheduled — it will pick up the next queued segment.
    // Without this guard, each pushed segment stacks another 20ms timer and
    // frames go out faster than realtime (the "choppy" audio bug).
    if (this.playbackTimer) return;
    const seg = this.playbackSegs[0];
    if (!seg) {
      this.playbackActive = false;
      this.flushPlaybackWaiters();
      return;
    }
    if (seg.payload === undefined) {
      // Head segment still synthesizing — wait for it, then resume.
      this.playbackActive = true;
      if (!seg.waiting) {
        seg.waiting = true;
        seg.ready.then(() => { seg.waiting = false; this.pumpPlayback(); });
      }
      return;
    }
    if (seg.payload === null || seg.offset >= seg.payload.length) {
      this.playbackSegs.shift();
      try { seg.resolve(); } catch {}
      return this.pumpPlayback();
    }
    this.playbackActive = true;
    const frameBytes = this.outCodec === 'pcmu' ? ULAW_FRAME_BYTES : Math.round(this.outRate * 2 * 0.02);
    const frame = seg.payload.subarray(seg.offset, seg.offset + frameBytes);
    seg.offset += frame.length;
    try {
      this.ws.send(JSON.stringify({ event: 'media', media: { payload: frame.toString('base64') } }));
    } catch { return this.stopPlayback(); }
    this.playbackTimer = setTimeout(() => { this.playbackTimer = null; this.pumpPlayback(); }, 20);
  }

  stopPlayback() {
    for (const seg of this.playbackSegs) { try { seg.resolve(); } catch {} }
    this.playbackSegs = [];
    if (this.playbackTimer) { clearTimeout(this.playbackTimer); this.playbackTimer = null; }
    try { this.ws?.send(JSON.stringify({ event: 'clear' })); } catch {}
    this.playbackActive = false;
    this.flushPlaybackWaiters();
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.idleTimer); clearTimeout(this.maxTimer); clearTimeout(this.flushTimer); clearTimeout(this.busFlushTimer);
    this.stopPlayback();
    this.releaseBus();
    this.ws?.close();
    if (process.env.PCM_DEBUG_DUMP === '1' && this.dumpBuf?.length) {
      try {
        writeFileSync(`/tmp/inbound-${this.ccid.replace(/[^\w-]/g, '')}.pcm`, Buffer.concat(this.dumpBuf));
        log(`debug dump written on destroy ccid=${this.ccid} bytes=${this.dumpBytes || 0}`);
      } catch (e) { log(`dump write err: ${e.message}`); }
    }
  }
}

// ── HTTP + WS server ────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  if (!authorized(req, url)) return json(401, { error: 'unauthorized' });
  if (url.pathname === '/health') {
    rollDialDay();
    // Cost transparency (Cortex Home plan): PSTN is the only metered dependency.
    // Telnyx US outbound ≈ $0.005/min + ~$1/mo DID. Everything else is free-tier/self-hosted.
    return json(200, {
      ok: true, calls: calls.size, telnyx: !!TELNYX_API_KEY, from: TELNYX_FROM || null,
      metered: { carrier_usd_per_min: 0.005, did_monthly_usd: 1.0, calls_today: dialsToday },
    });
  }
  if (url.pathname === '/calls' && req.method === 'GET') {
    return json(200, { calls: [...calls.values()].map(c => ({ ccid: c.ccid, to: c.to, state: c.state, age_s: Math.round((Date.now() - c.createdAt) / 1000) })) });
  }
  if (url.pathname === '/dial' && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const to = String(body.to || '').replace(/[^\d+]/g, '');
      if (to.replace(/\D/g, '').length < 10) return json(400, { error: 'valid `to` number required' });
      const greetingText = String(body.greeting || '').trim().slice(0, 300)
        || "Hey, it's Cortex — what's up?";
      const out = await dial(to.startsWith('+') ? to : `+1${to}`, greetingText);
      dialsToday += 1;
      return json(200, { ...out, cost_note: 'PSTN metered ~$0.005/min via Telnyx; LLM/STT/TTS are free-tier or self-hosted.' });
    } catch (e) { return json(500, { error: e.message }); }
  }
  if (url.pathname === '/hangup' && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const ccid = String(body.call_control_id || '');
      if (!calls.has(ccid)) return json(404, { error: 'no such call' });
      await hangup(ccid);
      return json(200, { ok: true });
    } catch (e) { return json(500, { error: e.message }); }
  }
  json(404, { error: 'not found' });
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname !== '/media') { socket.destroy(); return; }
  const ccid = url.searchParams.get('ccid') || '';
  const tok = url.searchParams.get('tok') || '';
  if (tok !== BRIDGE_TOKEN || !calls.has(ccid)) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const session = calls.get(ccid);
    session.attach(ws);
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'start' && msg.start?.media_format) {
          session.setMediaFormat(msg.start.media_format);
        } else if (msg.event === 'media' && msg.media?.payload) {
          session.onAudioChunk(session.decodeInbound(msg.media.payload));
        } else if (msg.event === 'stop' || msg.event === 'disconnected') {
          log(`media ${msg.event} ccid=${ccid}`);
          hangup(ccid).catch(() => {});
        }
      } catch {}
    });
    ws.on('close', () => {
      log(`media ws closed ccid=${ccid}`);
      if (calls.has(ccid)) hangup(ccid).catch(() => {});
    });
    ws.on('error', (e) => log(`ws error ccid=${ccid}: ${e.message}`));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`listening on 127.0.0.1:${PORT} media=${VOICE_MEDIA_URL || '(unset)'} from=${TELNYX_FROM || '(unset)'} model=${GROQ_MODEL}`);
});
