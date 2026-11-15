import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Cortana Orb ─────────────────────────────────────────────────────
// Based on the SyncScript landing page orb (HeroScene) but adapted for Cortana:
// - Mood-reactive colors (cyan idle → purple thinking → teal speaking → red alert)
// - Voice-driven animation (expand when speaking, contract when thinking)
// - Simplex noise displacement for organic movement
// - Particle twinkle, energy pulse, traveling wave
// - Inner glow core that pulses with speech

const PARTICLE_COUNT = 1200;
const RING_RADIUS = 1.4;
const TUBE_RADIUS = 0.45;

// ── Mood → orb state mapping ───────────────────────────────────────
const MOOD_STATES: Record<string, {
  color1: string; color2: string; expand: number; spread: number;
  noiseAmp: number; speed: number; brightness: number; opacity: number;
}> = {
  idle:       { color1: '#00ccff', color2: '#0088aa', expand: 1.0, spread: 0, noiseAmp: 0.6, speed: 0.7, brightness: 1.3, opacity: 0.9 },
  listening:  { color1: '#00eeff', color2: '#00aacc', expand: 1.05, spread: 0.05, noiseAmp: 0.8, speed: 0.9, brightness: 1.4, opacity: 0.92 },
  speaking:   { color1: '#00ffcc', color2: '#00aa88', expand: 1.3, spread: 0.15, noiseAmp: 1.2, speed: 1.4, brightness: 1.8, opacity: 0.95 },
  thinking:   { color1: '#cc44ff', color2: '#8822cc', expand: 0.7, spread: 0, noiseAmp: 0.4, speed: 0.4, brightness: 1.0, opacity: 0.85 },
  alert:      { color1: '#ff6644', color2: '#cc3322', expand: 1.5, spread: 0.3, noiseAmp: 2.0, speed: 2.0, brightness: 2.0, opacity: 0.95 },
  urgent:     { color1: '#ff3322', color2: '#aa1111', expand: 1.8, spread: 0.4, noiseAmp: 2.5, speed: 2.5, brightness: 2.2, opacity: 1.0 },
};

// ── Vertex shader (simplex noise + expand + spread) ─────────────────
const VERT = `
  uniform float uTime;
  uniform float uExpand;
  uniform float uSpread;
  uniform float uNoiseAmp;
  uniform float uSpeed;
  uniform float uScale;
  attribute float aRandom;
  attribute float aSize;
  attribute float aAngle;
  attribute float aPhase;
  varying float vAlpha;
  varying float vAngle;
  varying float vRandom;
  varying float vPhase;

  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main(){
    float t=uTime*uSpeed;
    vec3 pos=position*uExpand*uScale;
    vec3 radial=normalize(vec3(pos.xy,0.0)+vec3(0.001));
    pos+=radial*uSpread*(0.5+aRandom)*4.0;
    pos.z+=uSpread*(aRandom-0.5)*3.0;

    float n1=snoise(pos*1.2+t*0.08);
    float n2=snoise(pos*2.4+t*0.05+50.0)*0.4;
    pos+=normal*(n1*0.15+n2*0.08)*uNoiseAmp;

    vAlpha=0.15+aRandom*0.35;
    vAngle=aAngle;
    vRandom=aRandom;
    vPhase=aPhase;

    vec4 mvPosition=modelViewMatrix*vec4(pos,1.0);
    gl_PointSize=aSize*uScale*(300.0/-mvPosition.z);
    gl_Position=projectionMatrix*mvPosition;
  }
`;

// ── Fragment shader (twinkle + pulse + color blend + core glow) ─────
const FRAG = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uSpeed;
  varying float vAlpha;
  varying float vAngle;
  varying float vRandom;
  varying float vPhase;

void main(){
float d=length(gl_PointCoord-vec2(0.5));
if(d>0.5) discard;

float t=uTime*uSpeed;

// Sharp bright core (matches HeroScene)
float core=smoothstep(0.12,0.0,d);

// Subtle thin halo
float halo=exp(-d*18.0)*0.2;

float alpha=(core*0.9+halo)*vAlpha;

// Per-particle twinkle
float twinkle=sin(t*(1.5+vRandom*3.0)+vPhase*6.2832)*0.25+0.75;
alpha*=twinkle;

// Traveling energy pulse — THE shimmer effect
// Bright bands sweep around the ring (like landing page on scroll)
float travel=fract(vAngle/6.2832+t*0.03);
float pulse=sin(travel*6.2832*3.0+t*0.5)*0.2+0.8;

// When speaking (high brightness), add extra shimmer bands
// that counter-rotate, creating a rich interference pattern
float shimmerPulse=mix(pulse,
  pulse*(1.0+sin(travel*6.2832*5.0-t*2.0)*0.35),
  clamp(uBrightness-1.0,0.0,1.0));
alpha*=shimmerPulse;

float colorMix=fract(vAngle/6.2832+vRandom*0.3);
vec3 color=mix(uColor1,uColor2,colorMix);
vec3 finalColor=mix(color,vec3(1.0),core*0.3*uBrightness);
finalColor*=(0.7+0.3*uBrightness);

gl_FragColor=vec4(finalColor,alpha*uOpacity);
}
`;

// ── Create particle ring geometry ───────────────────────────────────
function createParticles() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const normals = new Float32Array(PARTICLE_COUNT * 3);
  const randoms = new Float32Array(PARTICLE_COUNT);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const angles = new Float32Array(PARTICLE_COUNT);
  const phases = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 2;
    const tubeR = TUBE_RADIUS * (0.3 + Math.random() * 0.7);

    positions[i * 3]     = (RING_RADIUS + tubeR * Math.cos(phi)) * Math.cos(theta);
    positions[i * 3 + 1] = (RING_RADIUS + tubeR * Math.cos(phi)) * Math.sin(theta);
    positions[i * 3 + 2] = tubeR * Math.sin(phi);

    normals[i * 3]     = Math.cos(phi) * Math.cos(theta);
    normals[i * 3 + 1] = Math.cos(phi) * Math.sin(theta);
    normals[i * 3 + 2] = Math.sin(phi);

    randoms[i] = Math.random();
    sizes[i] = 2.0 + Math.random() * 3.5;
    angles[i] = theta;
    phases[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return geo;
}

// ── R3F Particle Component ──────────────────────────────────────────
function ParticleRing({ mood }: { mood: string }) {
  const pointsRef = useRef<THREE.Points>(null);
  const geo = useMemo(() => createParticles(), []);

  const moodState = MOOD_STATES[mood] || MOOD_STATES.idle;

  // Target values for smooth lerp
  const targetRef = useRef({
    color1: new THREE.Color(moodState.color1),
    color2: new THREE.Color(moodState.color2),
    expand: moodState.expand,
    spread: moodState.spread,
    noiseAmp: moodState.noiseAmp,
    speed: moodState.speed,
    brightness: moodState.brightness,
    opacity: moodState.opacity,
  });

  const currentRef = useRef({
    color1: new THREE.Color(moodState.color1),
    color2: new THREE.Color(moodState.color2),
    expand: moodState.expand,
    spread: moodState.spread,
    noiseAmp: moodState.noiseAmp,
    speed: moodState.speed,
    brightness: moodState.brightness,
    opacity: moodState.opacity,
  });

  // Update targets when mood changes
  useEffect(() => {
    const s = MOOD_STATES[mood] || MOOD_STATES.idle;
    console.log("[cortana-orb] mood →", mood, "expand:", s.expand, "brightness:", s.brightness);
    targetRef.current.color1.set(s.color1);
    targetRef.current.color2.set(s.color2);
    targetRef.current.expand = s.expand;
    targetRef.current.spread = s.spread;
    targetRef.current.noiseAmp = s.noiseAmp;
    targetRef.current.speed = s.speed;
    targetRef.current.brightness = s.brightness;
    targetRef.current.opacity = s.opacity;
  }, [mood]);

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const mat = points.material as THREE.ShaderMaterial;
    const cur = currentRef.current;
    const tgt = targetRef.current;

// ── Speech shimmer: landing-page-style keyframe shimmer ────────
// Replicates the scroll-driven shimmer from HeroScene but driven
// by speech state instead of scroll position. The shimmer comes
// from surging speed + noise + brightness together in waves,
// while the traveling pulse in the shader sweeps bright bands
// around the ring — exactly like the landing page orb on scroll.
const isSpeaking = mood === 'speaking';
const isListening = mood === 'listening';
const isActive = isSpeaking || isListening;
const t = state.clock.elapsedTime;

// Speech shimmer has 3 overlapping wave frequencies for organic feel
// This matches the keyframe interpolation of the landing page orb:
// Wave 1 (slow): overall expand/contract — like scrolling into a section
// Wave 2 (medium): brightness surge — like the energy pulse on scroll
// Wave 3 (fast): noise + speed spike — like the shimmer transit
const wave1 = isActive
  ? Math.sin(t * (isSpeaking ? 1.8 : 0.8)) * 0.5 + 0.5  // 0..1 slow cycle
  : 0;
const wave2 = isActive
  ? Math.sin(t * (isSpeaking ? 3.5 : 1.5) + 1.0) * 0.5 + 0.5  // 0..1 medium cycle, offset
  : 0;
const wave3 = isActive
  ? Math.max(0, Math.sin(t * (isSpeaking ? 6.0 : 2.5) + 2.0))  // 0..1 fast spikes
  : 0;

// Apply waves to orb parameters — matching landing page keyframe behavior
// Expand: surges with wave1 (breathe in/out), spikes with wave3 (emphasis)
const shimmerExpand = isActive
  ? wave1 * (isSpeaking ? 0.8 : 0.15) + wave3 * (isSpeaking ? 0.5 : 0.05)
  : 0;
// Spread: opens on wave1 peak, subtle on wave2
const shimmerSpread = isActive
  ? wave1 * (isSpeaking ? 0.5 : 0.06) + wave2 * (isSpeaking ? 0.15 : 0.02)
  : 0;
// Noise: spikes with wave3 (the chaotic shimmer moment)
const shimmerNoise = isActive
  ? wave3 * (isSpeaking ? 2.0 : 0.3) + wave1 * (isSpeaking ? 0.6 : 0.1)
  : 0;
// Speed: surges with wave2 (the energy rush), extra spike with wave3
const shimmerSpeed = isActive
  ? wave2 * (isSpeaking ? 1.5 : 0.3) + wave3 * (isSpeaking ? 0.8 : 0.1)
  : 0;
// Brightness: brilliant flash on wave2 peak (the signature shimmer)
const shimmerBrightness = isActive
  ? wave2 * (isSpeaking ? 1.2 : 0.2) + wave3 * (isSpeaking ? 0.6 : 0.05)
  : 0;

const effectiveExpand = tgt.expand + shimmerExpand;
const effectiveSpread = Math.max(0, tgt.spread + shimmerSpread);
const effectiveNoise = tgt.noiseAmp + shimmerNoise;
const effectiveSpeed = tgt.speed + shimmerSpeed;
const effectiveBrightness = tgt.brightness + shimmerBrightness;

// ── Asymmetric lerp: snap into active, ease back to idle ──────
// Entering speaking/listening = FAST (0.15), returning to idle = SLOW (0.04)
// This ensures the orb visibly reaches shimmer state quickly, but
// smoothly relaxes back — no jarring snap-back to idle
const LERP_IN = 0.15;   // Fast approach to active states
const LERP_OUT = 0.04;  // Slow return to idle (lingering shimmer)
const lerpExpand = isActive ? LERP_IN : LERP_OUT;
const lerpOther = isActive ? LERP_IN : 0.06;

cur.color1.lerp(tgt.color1, lerpOther);
cur.color2.lerp(tgt.color2, lerpOther);
cur.expand += (effectiveExpand - cur.expand) * lerpExpand;
cur.spread += (effectiveSpread - cur.spread) * lerpExpand;
cur.noiseAmp += (effectiveNoise - cur.noiseAmp) * lerpOther;
cur.speed += (effectiveSpeed - cur.speed) * lerpOther;
cur.brightness += (effectiveBrightness - cur.brightness) * lerpOther;
cur.opacity += (tgt.opacity - cur.opacity) * lerpOther;

    // Apply to uniforms
    mat.uniforms.uTime.value += delta;
    mat.uniforms.uColor1.value.copy(cur.color1);
    mat.uniforms.uColor2.value.copy(cur.color2);
    mat.uniforms.uExpand.value = cur.expand;
    mat.uniforms.uSpread.value = cur.spread;
    mat.uniforms.uNoiseAmp.value = cur.noiseAmp;
    mat.uniforms.uSpeed.value = cur.speed;
    mat.uniforms.uBrightness.value = cur.brightness;
    mat.uniforms.uOpacity.value = cur.opacity;

    // Gentle rotation — centered with slight tilt
    points.rotation.z += delta * 0.06;
    points.rotation.x = Math.PI * 0.08 + Math.sin(state.clock.elapsedTime * 0.3) * 0.03;
  });

  return (
    <points ref={pointsRef} geometry={geo}>
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={{
          uTime: { value: 0 },
          uColor1: { value: new THREE.Color(moodState.color1) },
          uColor2: { value: new THREE.Color(moodState.color2) },
          uOpacity: { value: moodState.opacity },
          uExpand: { value: moodState.expand },
          uSpread: { value: moodState.spread },
          uNoiseAmp: { value: moodState.noiseAmp },
          uSpeed: { value: moodState.speed },
          uScale: { value: 1.0 },
          uBrightness: { value: moodState.brightness },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Inner glow core (pure additive light, no visible sphere) ────────
// This is NOT a separate object — it's removed. The orb ring particles
// already produce a natural center glow from additive blending.
// Having a separate sphere creates the "small circle" artifact.

// ── Exported component ──────────────────────────────────────────────
export function CortanaOrb({ mood }: { mood: string }) {
  return <ParticleRing mood={mood} />;
}

export default CortanaOrb;
