/**
 * Cortana neural playback — HTMLAudio primary (reliable on macOS), WebAudio fallback.
 * Recreates AudioContext after device/renderer errors. No speechSynthesis.
 */

let sharedCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentHtml: HTMLAudioElement | null = null;
let objectUrl: string | null = null;

function makeCtx(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AC();
}

function getCtx(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = makeCtx();
  }
  return sharedCtx;
}

function resetCtx(): void {
  if (sharedCtx) {
    try {
      void sharedCtx.close();
    } catch {
      /* ignore */
    }
  }
  sharedCtx = null;
}

export function stopCortanaAudio(): void {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      /* already stopped */
    }
    try {
      currentSource.disconnect();
    } catch {
      /* ignore */
    }
    currentSource = null;
  }
  if (currentHtml) {
    try {
      currentHtml.pause();
      currentHtml.removeAttribute('src');
      currentHtml.load();
    } catch {
      /* ignore */
    }
    currentHtml = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

/** Call from a click (Listen / Test voice) so later wake-word TTS can play. */
export function unlockCortanaAudio(): void {
  try {
    const a = new Audio(
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
    );
    a.volume = 0.01;
    void a.play().then(() => a.pause()).catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    const ctx = getCtx();
    void ctx.resume().catch(() => {
      resetCtx();
    });
  } catch {
    resetCtx();
  }
}

async function playViaHtmlAudio(
  data: ArrayBuffer,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<void> {
  stopCortanaAudio();
  const blob = new Blob([data], { type: 'audio/mpeg' });
  objectUrl = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = objectUrl;
  audio.volume = 1;
  currentHtml = audio;

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      currentHtml = null;
    };
    audio.onended = () => {
      cleanup();
      onEnd?.();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      onEnd?.();
      reject(new Error('html audio error'));
    };
    const tryPlay = () => {
      onStart?.();
      void audio.play().catch((err) => {
        cleanup();
        onEnd?.();
        reject(err);
      });
    };
    if (audio.readyState >= 3) {
      tryPlay();
    } else {
      audio.oncanplaythrough = tryPlay;
      audio.load();
    }
  });
}

async function playViaWebAudio(
  buf: ArrayBuffer,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<void> {
  let ctx: AudioContext;
  try {
    ctx = getCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch {
    resetCtx();
    ctx = getCtx();
    await ctx.resume();
  }

  const copy = buf.slice(0);
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(copy);
  } catch {
    resetCtx();
    ctx = getCtx();
    await ctx.resume();
    audioBuffer = await ctx.decodeAudioData(buf.slice(0));
  }

  stopCortanaAudio();
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  currentSource = source;

  await new Promise<void>((resolve, reject) => {
    source.onended = () => {
      currentSource = null;
      onEnd?.();
      resolve();
    };
    try {
      onStart?.();
      source.start(0);
    } catch (e) {
      currentSource = null;
      resetCtx();
      onEnd?.();
      reject(e);
    }
  });
}

export type CortanaPlayResult = { ok: true } | { ok: false; reason: string };

export async function playCortanaMp3(
  data: ArrayBuffer,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<CortanaPlayResult> {
  if (data.byteLength <= 100) {
    onEnd?.();
    return { ok: false, reason: 'empty_audio' };
  }

  // HTMLAudio first — avoids WebAudio device/renderer crashes on some macOS sessions
  try {
    await playViaHtmlAudio(data, onStart, onEnd);
    return { ok: true };
  } catch (htmlErr) {
    try {
      await playViaWebAudio(data, onStart, onEnd);
      return { ok: true };
    } catch (webErr) {
      onEnd?.();
      const msg = String(htmlErr ?? webErr);
      if (/NotAllowedError|play\(\)|user didn't interact|not allowed/i.test(msg)) {
        return { ok: false, reason: 'autoplay_blocked' };
      }
      return { ok: false, reason: 'play_failed' };
    }
  }
}
