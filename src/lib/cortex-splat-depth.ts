/**
 * cortex-splat-depth — single-image → Gaussian splat via zero-shot depth
 * estimation + pinhole unprojection (the BLUNT approach, JS-native).
 *
 * Pipeline: image → Depth-Anything-V2-Small (ONNX, transformers.js,
 * onnxruntime-node backend) → relative depth map → unproject pixels into
 * a splat cloud colored by the source image → binary INRIA PLY.
 * No diffusion, no multi-view training — seconds on CPU, ~100MB model
 * downloaded once from HuggingFace and cached.
 */
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { writeSplatPly, type GenSplatResult } from './cortex-splat-gen';

interface SplatPt { x: number; y: number; z: number; r: number; g: number; b: number; s: number; o: number; }

let depthPipe: any = null;
let depthPipePromise: Promise<any> | null = null;

async function getDepthPipe() {
  if (depthPipe) return depthPipe;
  if (!depthPipePromise) {
    depthPipePromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Node path uses onnxruntime-node; keep caches inside the repo so
      // the model survives restarts and never touches ~/.cache.
      env.cacheDir = path.join(process.cwd(), 'node_modules', '.cache', 'hf');
      return pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small');
    })().then((p) => { depthPipe = p; return p; })
      .catch((e) => { depthPipePromise = null; throw e; });
  }
  return depthPipePromise;
}

/** Fetch an image (http(s) or local /public path) → RGBA pixels. */
async function loadImagePixels(src: string): Promise<{ data: Uint8ClampedArray | Uint8Array; width: number; height: number }> {
  let buf: Buffer;
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`image fetch HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    // Local asset — resolve inside public/ or repo root.
    const rel = src.replace(/^\/+/, '');
    const candidates = [
      path.join(process.cwd(), 'public', rel),
      path.join(process.cwd(), rel),
    ];
    const { readFileSync, existsSync } = await import('fs');
    const hit = candidates.find((c) => existsSync(c));
    if (!hit) throw new Error(`image not found: ${src}`);
    buf = readFileSync(hit);
  }
  // Decode via sharp if present, else jimp-free fallback: transformers.js
  // RawImage can decode buffers directly — use it.
  const { RawImage } = await import('@huggingface/transformers');
  const img = await RawImage.fromBlob(new Blob([new Uint8Array(buf)]));
  return { data: img.data, width: img.width, height: img.height };
}

/**
 * Image → splat. `src` is an https URL or a /public-relative path.
 * `density` = pixel stride (lower = more splats, slower).
 */
export async function generateSplatFromImage(opts: {
  image: string;
  seed?: number;
  maxSplats?: number;
  stride?: number;
}): Promise<GenSplatResult> {
  const pipe = await getDepthPipe();
  const img = await loadImagePixels(opts.image);
  const W = img.width, H = img.height;

  // Depth estimation wants the image as a RawImage-like input; reuse the
  // decoded pixels by re-encoding to PNG data URL is wasteful — transformers
  // accepts RawImage directly.
  const { RawImage } = await import('@huggingface/transformers');
  const input = new RawImage(img.data as Uint8ClampedArray, W, H, 4);
  const out = await pipe(input);

  // out.depth is a RawImage (1 channel) of relative depth. DA-V2 outputs
  // disparity-style values: NEARER surfaces have LARGER raw values.
  const depth = out?.depth;
  if (!depth || !depth.data) throw new Error('depth model returned no map');
  const dw = depth.width, dh = depth.height;
  const dmax = 255;
  const stride = Math.max(1, Math.floor(opts.stride || 3));
  const maxSplats = Math.min(Math.max(opts.maxSplats || 90000, 2000), 180000);

  // Pinhole unprojection. Focal ≈ 0.85·max(W,H) (BLUNT heuristic — no EXIF
  // in arbitrary inputs). Depth normalized so the far plane sits at z=-2.2.
  const f = Math.max(W, H) * 0.85;
  const cx = W / 2, cy = H / 2;
  const pts: SplatPt[] = [];

  for (let v = 0; v < dh && pts.length < maxSplats; v += stride) {
    for (let u = 0; u < dw && pts.length < maxSplats; u += stride) {
      const di = v * dw + u;
      const d = depth.data[di]; // 0..255, larger = nearer
      if (d < 8) { continue; } // near-zero depth = sky/void — skip
      // Map to source-image pixel for color (depth map is smaller than src).
      const su = Math.min(W - 1, Math.floor((u / dw) * W));
      const sv = Math.min(H - 1, Math.floor((v / dh) * H));
      const si = (sv * W + su) * 4;
      const hasAlpha = img.data.length === W * H * 4;
      if (hasAlpha && (img.data as any)[si + 3] < 24) { continue; }
      const z = -((dmax - d) / dmax) * 2.2 - 0.15; // nearer → less negative
      const x = ((su - cx) / f) * -z;
      const y = -((sv - cy) / f) * -z;
      const r = (img.data as any)[si] / 255, g = (img.data as any)[si + 1] / 255, b = (img.data as any)[si + 2] / 255;
      // Scale by local depth gradient proxy — flat areas get softer splats.
      const s = 0.012 + (1 - d / dmax) * 0.02;
      pts.push({ x, y, z, r, g, b, s, o: 0.82 });
    }
  }
  if (pts.length < 500) throw new Error(`depth unprojection produced too few splats (${pts.length}) — try a subject-focused image`);

  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const hash = Math.abs(seed * 2654435761 % 2 ** 31).toString(36);
  const name = `gen-photo-${hash}`;
  const dir = path.join(process.cwd(), 'public', 'splats');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.ply`);
  writeFileSync(file, writeSplatPly(pts));
  return { file, url: `/splats/${name}.ply`, name, scene: 'photo', splats: pts.length, seed, palette: 'source' } as GenSplatResult;
}
