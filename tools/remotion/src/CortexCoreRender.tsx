import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

const CYAN = "#00e5ff";
const DEEP_BLUE = "#0a2a4a";

// ---------------------------------------------------------------------------
// Fresnel-rim shader sphere (deterministic, no DOM / network access)
// ---------------------------------------------------------------------------

const sphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    vPos = position;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const sphereFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCoreColor;
  uniform vec3 uRimColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vPos;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewDir);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.4);
    // slow internal pulse so the core "breathes"
    float pulse = 0.75 + 0.25 * sin(uTime * 1.4 + vPos.y * 3.0);
    vec3 color = mix(uCoreColor, uRimColor, fresnel * pulse);
    // subtle equatorial band glow
    float band = smoothstep(0.35, 0.0, abs(vPos.y - 0.0)) * 0.15;
    color += uRimColor * band * fresnel;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const Orb: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: sphereVertex,
      fragmentShader: sphereFragment,
      uniforms: {
        uTime: { value: 0 },
        uCoreColor: { value: new THREE.Color(DEEP_BLUE) },
        uRimColor: { value: new THREE.Color(CYAN) },
      },
    });
  }, []);

  material.uniforms.uTime.value = time;

  return (
    <mesh material={material}>
      <sphereGeometry args={[1.35, 96, 96]} />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// Orbiting particle ring (deterministic positions, rotated by frame)
// ---------------------------------------------------------------------------

const ParticleRing: React.FC<{
  count: number;
  radius: number;
  tiltX: number;
  tiltZ: number;
  speed: number;
  size: number;
  color: string;
  phase: number;
}> = ({ count, radius, tiltX, tiltZ, speed, size, color, phase }) => {
  const frame = useCurrentFrame();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    // deterministic pseudo-random via seeded LCG — no Math.random at render
    let seed = phase * 7919 + 13;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      // slight vertical scatter so the ring has thickness
      const y = (rand() - 0.5) * radius * 0.12;
      const r = radius * (0.94 + rand() * 0.12);
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count, radius, phase]);

  const angle = frame * speed + phase;
  return (
    <points
      geometry={geometry}
      rotation={[tiltX, angle, tiltZ]}
      frustumCulled={false}
    >
      <pointsMaterial
        size={size}
        color={color}
        transparent
        opacity={0.9}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// ---------------------------------------------------------------------------
// Slow orbital "glyph" dust field around the core
// ---------------------------------------------------------------------------

const GlyphDust: React.FC = () => {
  const frame = useCurrentFrame();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 900;
    const positions = new Float32Array(count * 3);
    let seed = 424242;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      // spherical shell distribution between r=2.2 and r=5.5
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = 2.2 + rand() * 3.3;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <points
      geometry={geometry}
      rotation={[0, frame * 0.0035, 0]}
      frustumCulled={false}
    >
      <pointsMaterial
        size={0.035}
        color={CYAN}
        transparent
        opacity={0.55}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// ---------------------------------------------------------------------------
// Camera rig — slow deterministic drift, assigned per frame (no useFrame loop)
// ---------------------------------------------------------------------------

const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { camera } = useThree();

  const t = frame / fps;
  const radius = 5.2;
  const drift = 0.22; // radians of sway over the whole shot
  const a = t * 0.12;
  camera.position.set(
    Math.sin(a) * radius + Math.sin(t * 0.5) * 0.15,
    0.55 + Math.sin(t * 0.31) * 0.3,
    Math.cos(a) * radius
  );
  camera.lookAt(0, 0, 0);
  return null;
};

// ---------------------------------------------------------------------------
// Scene root
// ---------------------------------------------------------------------------

const SovereignCoreScene: React.FC = () => {
  const frame = useCurrentFrame();

  // intro scale-in + gentle end drift
  const intro = interpolate(frame, [0, 45], [0.6, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <>
      <color attach="background" args={["#02040a"]} />
      <fog attach="fog" args={["#02040a", 6, 14]} />
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 0, 0]} intensity={2} color={CYAN} />
      <CameraRig />
      <group scale={intro}>
        <Orb />
        {/* inner sharp ring */}
        <ParticleRing
          count={220}
          radius={1.9}
          tiltX={1.15}
          tiltZ={0.25}
          speed={0.012}
          size={0.045}
          color={CYAN}
          phase={1.7}
        />
        {/* outer counter-rotating ring */}
        <ParticleRing
          count={320}
          radius={2.7}
          tiltX={-0.7}
          tiltZ={-0.4}
          speed={-0.008}
          size={0.03}
          color="#7df9ff"
          phase={4.2}
        />
        {/* tilted equatorial glyph ring */}
        <mesh rotation={[Math.PI / 2.4, frame * 0.004, 0]}>
          <torusGeometry args={[2.35, 0.006, 8, 256]} />
          <meshBasicMaterial
            color={CYAN}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <GlyphDust />
      </group>
    </>
  );
};

export const CortexCoreRender: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#02040a" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0.55, 5.2], fov: 45, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <SovereignCoreScene />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
