import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(join(__dirname, '../', rel), 'utf8');
}

test('Nexus voice: AudioContext resume + Kokoro direct fallback (no browser SpeechSynthesis)', () => {
  const ctx = read('src/contexts/NexusVoiceCallContext.tsx');
  const markers = [
    'didAudioPlay()',
    'await this.ctx.resume()',
    'await ctx.resume()',
    'ttsVoiceCandidates',
    'fetchDirectKokoroBuffer',
    'KOKORO_DIRECT_URL',
    'isVoiceOrClientError',
    'ensureSpokenOrNotify',
    'player.didAudioPlay()',
    'setVoiceError',
  ];
  for (const m of markers) {
    assert.ok(ctx.includes(m), `Expected NexusVoiceCallContext to include "${m}"`);
  }
  assert.ok(
    !ctx.includes('speakBrowserUtterance'),
    'Nexus must not use browser SpeechSynthesis (robotic); speakBrowserUtterance should be absent',
  );
  assert.ok(
    !ctx.includes('speechSynthesis'),
    'NexusVoiceCallContext must not reference window.speechSynthesis',
  );
});

test('Nexus voice: SSE must not double-queue TTS (tokens + finalContent)', () => {
  const ctx = read('src/contexts/NexusVoiceCallContext.tsx');
  assert.match(ctx, /ttsQueuedFromTokens/);
  assert.match(ctx, /Already queued TTS from token stream/);
});

test('nexus-guest: finalContent only on non-stream deterministic path (no token double-queue)', () => {
  // Route lives in src/server/nexus-guest.ts (Vite middleware), not api/ai/.
  // Invariant: token-streamed responses must not also emit finalContent,
  // or the client queues TTS twice. The provider stream path emits only
  // `token` events + [DONE]; finalContent appears exactly once, in the
  // deterministic pricing branch that emits no tokens.
  const api = read('src/server/nexus-guest.ts');
  const finalContentSites = api.match(/finalContent/g) || [];
  assert.equal(finalContentSites.length, 1, 'expected exactly one finalContent emission site');
  assert.match(api, /\{ token: /, 'stream path must emit token events');
  assert.match(api, /data: \[DONE\]/, 'stream path must terminate with [DONE]');
});

test('useVoiceStream: stop recognition restart on mic not-allowed', () => {
  const hook = read('src/hooks/useVoiceStream.ts');
  assert.match(hook, /event\.error === 'not-allowed'/);
  assert.match(hook, /shouldRestartRef\.current = false/);
});
