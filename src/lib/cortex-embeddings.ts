/**
 * cortex-embeddings.ts — local sentence embeddings for semantic memory recall.
 *
 * Uses @huggingface/transformers (already a dep) with Xenova/all-MiniLM-L6-v2
 * quantized — 384-dim vectors, ~90MB one-time HF cache download, runs fully
 * on-device. Lazy singleton: the pipeline only loads on first embed call so
 * importing this module costs nothing.
 *
 * Fail-soft contract: any load/inference error → null. Callers fall back to
 * substring recall. Embedding is an enhancement, never a dependency.
 */

import { pipeline } from '@huggingface/transformers';

type FeatureExtractor = (text: string, opts: { pooling: string; normalize: boolean }) => Promise<any>;

let extractorPromise: Promise<FeatureExtractor | null> | null = null;

function getExtractor(): Promise<FeatureExtractor | null> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })
      .then((p: any) => p as FeatureExtractor)
      .catch((e) => {
        console.warn('[cortex-embeddings] pipeline load failed:', String(e).slice(0, 160));
        return null;
      });
  }
  return extractorPromise;
}

/** Embed a single text → Float32Array(384), or null on failure. */
export async function embedText(text: string): Promise<Float32Array | null> {
  const ext = await getExtractor();
  if (!ext) return null;
  try {
    const out = await ext(String(text || '').slice(0, 2000), { pooling: 'mean', normalize: true });
    const data: any = out?.data;
    if (!data) return null;
    if (data instanceof Float32Array) return data;
    if (ArrayBuffer.isView(data)) {
      return new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    }
    return Float32Array.from(data);
  } catch {
    return null;
  }
}

/** Serialize a vector to a little-endian Float32 BLOB for sqlite storage. */
export function vecToBlob(v: Float32Array): Uint8Array {
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

export function blobToVec(b: Uint8Array | null | undefined): Float32Array | null {
  if (!b || b.byteLength === 0 || b.byteLength % 4 !== 0) return null;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

/** Cosine similarity — vectors are L2-normalized at extraction, so this is a dot product. */
export function cosineSim(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}
