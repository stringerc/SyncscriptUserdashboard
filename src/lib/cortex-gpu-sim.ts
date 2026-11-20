/**
 * CortexGpuSim — GPU ping-pong physics for Gaussian splats.
 *
 * GPUComputationRenderer drives position+velocity for up to W*H
 * particles entirely on the GPU: spring-to-anchor, ambient curl
 * turbulence, per-particle phase jitter, and cursor repulsion with
 * tangential swirl. Velocity persists in the velocity texture, so
 * disturbances recoil and settle with real momentum.
 *
 * The simulated position texture is consumed by the dyno position
 * modifier (cortex-splat-gpu-pos.ts) which maps splat index -> texel.
 */
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

export const SIM_W = 512;
export const SIM_H = 274; // 140,288 texels >= 140,000 dynamic splats
export const SIM_CAPACITY = SIM_W * SIM_H;

const FORCE_GLSL = /* glsl */ `
  vec3 anchor = texture2D(uAnchor, uv).xyz;
  float seed = texture2D(uAnchor, uv).w;
  vec3 acc = (anchor - pos) * 6.0;
  float amb = 0.16 * (1.0 + uGust * 1.8);
  acc += vec3(
    sin(pos.y * 1.9 + uTime * 0.6) + 0.45 * sin(pos.z * 3.3 - uTime * 0.9),
    sin(pos.z * 1.6 - uTime * 0.45) + 0.45 * sin(pos.x * 2.7 + uTime * 0.75),
    sin(pos.x * 2.1 + uTime * 0.55) + 0.45 * sin(pos.y * 3.0 + uTime * 1.05)
  ) * amb;
  acc += vec3(
    sin(uTime * 0.9 + seed * 6.2831),
    sin(uTime * 0.7 + seed * 12.566),
    cos(uTime * 1.1 + seed * 9.424)
  ) * 0.035;
  vec3 toC = pos - uCursor;
  float d2 = dot(toC, toC);
  float R = 1.6;
  if (d2 < R * R && uCursorStrength > 0.001) {
    float d = sqrt(d2) + 0.02;
    float infl = 1.0 - d / R;
    float w = infl * infl * uCursorStrength * (1.0 + uGust * 0.9);
    acc += (toC / d) * (7.0 * w);
    acc += vec3(-toC.z / d, 0.0, toC.x / d) * (3.4 * w);
    acc.y += sin(uTime * 3.0 + seed * 6.2831) * 3.4 * w * 0.4;
  }
  // Voice reactivity — Cortex speaking swells the field with a per-particle
  // phased chorus (syllabic, not uniform pumping); listening implodes
  // gently; thinking stirs the turbulence faster. Coefficients are large
  // on purpose: spring k=6.0 dominates small forces, so voice must push
  // hard enough to read as visible choreography at default zoom.
  float voice = uSpeak * (0.55 + 0.45 * sin(uTime * 6.3 + seed * 3.0));
  vec3 radial = normalize(pos + vec3(0.0001));
  acc += radial * voice * 1.9;
  acc += vec3(
    sin(pos.y * 4.0 + uTime * 9.0),
    sin(pos.z * 4.4 - uTime * 8.0),
    sin(pos.x * 3.8 + uTime * 10.0)
  ) * voice * 0.6;
  acc -= radial * uListen * 0.34;
  acc += vec3(
    sin(pos.z * 5.1 - uTime * 11.0),
    sin(pos.x * 4.6 + uTime * 12.5),
    sin(pos.y * 5.4 + uTime * 9.5)
  ) * uThink * 0.4;

  vel = (vel + acc * uDt) * exp(-2.4 * uDt);
  float sp2 = dot(vel, vel);
  if (sp2 > 9.0) vel *= 3.0 / sqrt(sp2);
`;

const VEL_SHADER = /* glsl */ `
  uniform sampler2D uAnchor;
  uniform vec3 uCursor;
  uniform float uCursorStrength;
  uniform float uGust;
  uniform float uTime;
  uniform float uDt;
  uniform float uSpeak;
  uniform float uListen;
  uniform float uThink;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    ${FORCE_GLSL}
    gl_FragColor = vec4(vel, 1.0);
  }
`;

const POS_SHADER = /* glsl */ `
  uniform sampler2D uAnchor;
  uniform vec3 uCursor;
  uniform float uCursorStrength;
  uniform float uGust;
  uniform float uTime;
  uniform float uDt;
  uniform float uSpeak;
  uniform float uListen;
  uniform float uThink;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    ${FORCE_GLSL}
    pos += vel * uDt;
    gl_FragColor = vec4(pos, 1.0);
  }
`;

export class CortexGpuSim {
  readonly gpu: GPUComputationRenderer;
  private posVar: any;
  private velVar: any;
  private anchorTex: THREE.DataTexture;
  private uCursor: { value: THREE.Vector3 };
  private uCursorStrength: { value: number };
  private uGust: { value: number };
  private uTime: { value: number };
  private uDt: { value: number };
  private uSpeak: { value: number };
  private uListen: { value: number };
  private uThink: { value: number };
  particleCount = 0;

  constructor(renderer: THREE.WebGLRenderer, anchors: Float32Array) {
    this.gpu = new GPUComputationRenderer(SIM_W, SIM_H, renderer);
    this.particleCount = Math.min(anchors.length / 4, SIM_CAPACITY);

    // Anchor texture — static homes + per-particle phase seed in w.
    const anchorData = new Float32Array(SIM_W * SIM_H * 4);
    anchorData.set(anchors.subarray(0, this.particleCount * 4));
    this.anchorTex = new THREE.DataTexture(anchorData, SIM_W, SIM_H, THREE.RGBAFormat, THREE.FloatType);
    this.anchorTex.minFilter = THREE.NearestFilter;
    this.anchorTex.magFilter = THREE.NearestFilter;
    this.anchorTex.needsUpdate = true;

    // Position init = anchor (avoids first-frame spring explosion), vel = 0.
    const posData = new Float32Array(SIM_W * SIM_H * 4);
    posData.set(anchorData);
    const posInit = this.gpu.createTexture();
    (posInit.image.data as Float32Array).set(posData);
    posInit.needsUpdate = true;
    const velInit = this.gpu.createTexture();

    this.posVar = this.gpu.addVariable('texturePosition', POS_SHADER, posInit);
    this.velVar = this.gpu.addVariable('textureVelocity', VEL_SHADER, velInit);
    this.gpu.setVariableDependencies(this.posVar, [this.posVar, this.velVar]);
    this.gpu.setVariableDependencies(this.velVar, [this.posVar, this.velVar]);

    this.uCursor = { value: new THREE.Vector3(0, 0, 5) };
    this.uCursorStrength = { value: 0 };
    this.uGust = { value: 0 };
    this.uTime = { value: 0 };
    this.uDt = { value: 0.016 };
    this.uSpeak = { value: 0 };
    this.uListen = { value: 0 };
    this.uThink = { value: 0 };

    for (const v of [this.posVar, this.velVar]) {
      const u = v.material.uniforms;
      u.uAnchor = { value: this.anchorTex };
      u.uCursor = this.uCursor;
      u.uCursorStrength = this.uCursorStrength;
      u.uGust = this.uGust;
      u.uTime = this.uTime;
      u.uDt = this.uDt;
      u.uSpeak = this.uSpeak;
      u.uListen = this.uListen;
      u.uThink = this.uThink;
    }

    const err = this.gpu.init();
    if (err) console.log('[gpu-sim] init error:', err);
    else console.log('[gpu-sim] online', { texels: SIM_W * SIM_H, particles: this.particleCount });
  }

  /** Advance one sim step; returns the texture holding current positions. */
  step(dt: number, cursor: THREE.Vector3, cursorStrength: number, gust: number, time: number, voice?: { speak?: number; listen?: number; think?: number }): THREE.Texture {
    this.uDt.value = Math.min(dt, 0.05);
    this.uCursor.value.copy(cursor);
    this.uCursorStrength.value = cursorStrength;
    this.uGust.value = gust;
    this.uTime.value = time;
    this.uSpeak.value = voice?.speak ?? 0;
    this.uListen.value = voice?.listen ?? 0;
    this.uThink.value = voice?.think ?? 0;
    this.gpu.compute();
    return this.gpu.getCurrentRenderTarget(this.posVar).texture;
  }

  dispose() {
    try { this.gpu.dispose(); } catch {}
    try { this.anchorTex.dispose(); } catch {}
  }
}
