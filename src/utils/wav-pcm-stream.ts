/**
 * Streaming WAV → PCM Float32 pipeline.
 *
 * pocket-tts (and any chunked WAV endpoint) emits a standard 44-byte-ish RIFF
 * header then raw PCM frames as they are generated. Instead of buffering the
 * whole utterance, we parse the header once, then convert PCM blocks to
 * Float32 mono chunks the moment they arrive — time-to-first-audio drops from
 * full-synthesis-time to header+first-frame (~150-500ms).
 */

export interface PcmChunk {
  samples: Float32Array;
  sampleRate: number;
}

/** Async queue bridging the network pump and the gapless audio scheduler. */
export class PcmQueue {
  private chunks: PcmChunk[] = [];
  private waiters: Array<() => void> = [];
  private done = false;
  private failure: unknown = null;
  private truncatedFlag = false;

  push(chunk: PcmChunk) {
    this.chunks.push(chunk);
    this.wake();
  }

  close() {
    this.done = true;
    this.wake();
  }

  fail(err: unknown) {
    this.failure = err;
    this.done = true;
    this.wake();
  }

  /** Mark the stream as server-truncated (EOF before declared data size
   *  or pump failure after partial delivery). Consumers use this to
   *  re-synthesize the sentence whole instead of accepting a cutoff. */
  markTruncated() {
    this.truncatedFlag = true;
  }

  wasTruncated(): boolean {
    return this.truncatedFlag || this.failure != null;
  }

  private wake() {
    const pending = this.waiters.splice(0);
    for (const fn of pending) fn();
  }

  async *iterate(): AsyncGenerator<PcmChunk> {
    for (;;) {
      const chunk = this.chunks.shift();
      if (chunk) {
        yield chunk;
        continue;
      }
      if (this.failure) throw this.failure;
      if (this.done) return;
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }
}

/** Buffered exact-length reader over a byte stream. */
class ByteReader {
  private parts: Uint8Array[] = [];
  private buffered = 0;
  private offset = 0;
  private eof = false;

  constructor(private reader: ReadableStreamDefaultReader<Uint8Array>) {}

  async read(n: number): Promise<Uint8Array | null> {
    const out = new Uint8Array(n);
    let filled = 0;
    while (filled < n) {
      if (this.offset >= this.buffered) {
        if (this.eof) {
          if (this.parts.length === 0 && filled === 0) return null;
          break;
        }
        const { done, value } = await this.reader.read();
        if (done) {
          this.eof = true;
          continue;
        }
        if (value && value.byteLength) {
          this.parts.push(value);
          this.buffered += value.byteLength;
          this.offset = 0;
          // Compact consumed parts lazily — keep at most a few.
          if (this.parts.length > 8) {
            const merged = new Uint8Array(this.buffered - this.offset);
            let w = 0;
            for (let i = 0; i < this.parts.length; i++) {
              const p = this.parts[i];
              const start = i === 0 ? this.offset : 0;
              merged.set(p.subarray(start), w);
              w += p.byteLength - start;
            }
            this.parts = [merged];
            this.buffered = merged.byteLength;
            this.offset = 0;
          }
        }
        continue;
      }
      // Copy from current part.
      const part = this.parts[0];
      const avail = part.byteLength - this.offset;
      const take = Math.min(avail, n - filled);
      out.set(part.subarray(this.offset, this.offset + take), filled);
      this.offset += take;
      filled += take;
      if (this.offset >= part.byteLength) {
        this.parts.shift();
        this.buffered -= part.byteLength;
        this.offset = 0;
      }
    }
    if (filled === 0) return null;
    return filled === n ? out : out.subarray(0, filled);
  }
}

function u16(v: DataView, o: number) { return v.getUint16(o, true); }
function u32(v: DataView, o: number) { return v.getUint32(o, true); }

export interface WavFormat {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
}

/**
 * Parse a RIFF/WAVE header. Returns the format plus a ByteReader positioned at
 * the `data` chunk payload. Tolerates unknown extra chunks and unpatched
 * streamed sizes (reads to EOF rather than trusting declared lengths).
 */
export async function parseWavHeader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<{ format: WavFormat; data: ByteReader; dataSize: number }> {
  const br = new ByteReader(reader);
  const riff = await br.read(12);
  if (!riff || riff.byteLength < 12) throw new Error('not a WAV stream');
  const riffStr = String.fromCharCode(riff[0], riff[1], riff[2], riff[3]);
  const waveStr = String.fromCharCode(riff[8], riff[9], riff[10], riff[11]);
  if (riffStr !== 'RIFF' || waveStr !== 'WAVE') throw new Error('not a WAV stream');

  let format: WavFormat | null = null;
  let dataSize = 0;
  for (;;) {
    const head = await br.read(8);
    if (!head || head.byteLength < 8) throw new Error('WAV missing data chunk');
    const id = String.fromCharCode(head[0], head[1], head[2], head[3]);
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    const size = u32(dv, 4);
    if (id === 'fmt ') {
      const body = await br.read(Math.min(size, 40));
      if (!body || body.byteLength < 16) throw new Error('bad fmt chunk');
      const fdv = new DataView(body.buffer, body.byteOffset, body.byteLength);
      format = {
        audioFormat: u16(fdv, 0),
        channels: u16(fdv, 2),
        sampleRate: u32(fdv, 4),
        bitsPerSample: u16(fdv, 14),
      };
      const consumed = body.byteLength;
      const remaining = size - consumed;
      if (remaining > 0) await br.read(remaining + (size & 1));
      else if (size & 1) await br.read(1);
    } else if (id === 'data') {
      if (!format) throw new Error('WAV data before fmt');
      if (format.audioFormat !== 1 && format.audioFormat !== 3) {
        throw new Error(`unsupported WAV encoding ${format.audioFormat}`);
      }
      dataSize = size;
      return { format, data: br, dataSize };
    } else {
      // Skip unknown chunk (pad to even).
      const skip = size + (size & 1);
      let left = skip;
      while (left > 0) {
        const part = await br.read(Math.min(left, 65536));
        if (!part) break;
        left -= part.byteLength;
      }
    }
  }
}

/** s16le PCM → mono Float32, honoring channel count. */
function pcmToFloat32(
  bytes: Uint8Array,
  channels: number,
  bitsPerSample: number,
  audioFormat: number,
): Float32Array {
  if (audioFormat === 3 && bitsPerSample === 32) {
    const n = Math.floor(bytes.byteLength / 4);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, n * 4);
    const frames = Math.floor(n / channels);
    const out = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (let c = 0; c < channels; c++) sum += dv.getFloat32((i * channels + c) * 4, true);
      out[i] = sum / channels;
    }
    return out;
  }
  if (bitsPerSample !== 16) throw new Error(`unsupported bit depth ${bitsPerSample}`);
  const n = Math.floor(bytes.byteLength / 2);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  const frames = Math.floor(n / channels);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += dv.getInt16((i * channels + c) * 2, true) / 32768;
    out[i] = sum / channels;
  }
  return out;
}

const PCM_BLOCK_BYTES = 16384; // ~340ms at 24kHz mono — smooth scheduling granularity

/**
 * Pump a WAV byte stream into a PcmQueue of Float32 mono chunks.
 * Resolves when the stream ends; rejects on parse/IO errors.
 */
export async function pumpWavToPcm(
  body: ReadableStream<Uint8Array>,
  queue: PcmQueue,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const onAbort = () => { try { reader.cancel(); } catch { } };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const { format, data, dataSize } = await parseWavHeader(reader);
    const bytesPerFrame = format.channels * (format.bitsPerSample / 8);
    const blockFrames = Math.max(1, Math.floor(PCM_BLOCK_BYTES / bytesPerFrame));
    const blockBytes = blockFrames * bytesPerFrame;
    let payloadBytes = 0;
    for (;;) {
      if (signal?.aborted) return;
      const block = await data.read(blockBytes);
      if (!block || block.byteLength === 0) break;
      payloadBytes += block.byteLength;
      const samples = pcmToFloat32(block, format.channels, format.bitsPerSample, format.audioFormat);
      if (samples.length) queue.push({ samples, sampleRate: format.sampleRate });
    }
    // Declared-size check: streamed WAV headers sometimes carry a real
    // data length. EOF short of it means the server cut the utterance —
    // flag truncation so the consumer re-speaks the sentence whole
    // instead of accepting an abrupt mid-word stop. dataSize <= 0 or
    // absurdly large (0xFFFFFFFF streaming placeholder) → can't judge.
    if (dataSize > 0 && dataSize < 0x7fffffff && payloadBytes < dataSize) {
      queue.markTruncated();
    }
    queue.close();
  } catch (err) {
    queue.markTruncated();
    queue.fail(err);
    throw err;
  } finally {
    // Abort/error paths must still close the queue — otherwise consumers
    // waiting in iterate() hang forever and the drain stalls.
    queue.close();
    signal?.removeEventListener('abort', onAbort);
    try { reader.releaseLock(); } catch { }
  }
}
