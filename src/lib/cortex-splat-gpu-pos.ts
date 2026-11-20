/**
 * createGpuPosModifier — dyno worldModifier that replaces each splat's
 * center with its GPU-simulated position.
 *
 * Splat index (+ per-mesh offset) maps to a texel in the sim position
 * texture; a slow rigid Y-rotation is applied at render time so the
 * whole field visibly spins without disturbing the physics frame.
 */
import * as THREE from 'three';
import { dyno } from '@sparkjsdev/spark';
import { SIM_W, SIM_H } from './cortex-gpu-sim';

const D = dyno;

export interface GpuPosUniforms {
  simPos: { value: THREE.Texture | null };
  indexOffset: { value: number };
  spin: { value: number };
}

export function createGpuPosModifier(indexOffset: number): { modifier: any; uniforms: GpuPosUniforms } {
  const uSimPos = D.dynoSampler2D(null as any, 'uSimPos');
  const uIndexOffset = D.dynoInt(indexOffset, 'uSimIndexOffset');
  const uSpin = D.dynoFloat(0, 'uSimSpin');

  const W = D.dynoConst('int', SIM_W);
  const H = D.dynoConst('int', SIM_H);

  const modifier = D.dynoBlock(
    { gsplat: D.Gsplat },
    { gsplat: D.Gsplat },
    ({ gsplat }: any) => {
      if (!gsplat) throw new Error('gpuPosModifier: missing gsplat');
      const idx = D.splitGsplat(gsplat).outputs.index;
      const flat = D.add(idx, uIndexOffset);
      // clamp into texture bounds — out-of-range splats freeze at edge
      const fx = D.min(D.max(flat, D.dynoConst('int', 0)), D.dynoConst('int', SIM_W * SIM_H - 1));
      const coord = D.combine({
        vectorType: 'ivec2',
        x: D.imod(fx, W),
        y: D.int(D.div(D.float(fx), D.float(W))),
      });
      const simPos: any = D.texelFetch(uSimPos as any, coord as any);
      const sp: any = D.split(simPos);
      const px = sp.outputs.x;
      const py = sp.outputs.y;
      const pz = sp.outputs.z;

      // Rigid Y-spin applied to the simulated position only.
      const c = D.cos(uSpin);
      const s = D.sin(uSpin);
      const rx = D.add(D.mul(px, c), D.mul(pz, s));
      const rz = D.sub(D.mul(pz, c), D.mul(px, s));

      return {
        gsplat: D.combineGsplat({
          gsplat,
          center: D.combine({ vectorType: 'vec3', x: rx as any, y: py as any, z: rz as any }),
        }),
      };
    },
    { globals: () => [D.defineGsplat] },
  );

  return {
    modifier,
    uniforms: {
      simPos: uSimPos as any,
      indexOffset: uIndexOffset as any,
      spin: uSpin as any,
    },
  };
}
