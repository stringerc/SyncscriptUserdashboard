/**
 * createFlowModifier — GPU flow-field modifier for Gaussian splats.
 *
 * Returns a Spark `worldModifier` (Dyno<{gsplat},{gsplat}>) plus live
 * uniforms the scene animates each frame:
 *
 *  - ambient curl flow: position-keyed sin octaves so neighboring
 *    splats move coherently — liquid/murmuration motion, stateless
 *    (particles always return to their field position)
 *  - cursor interaction: splats inside uMouse radius are pushed away
 *    with a tangential swirl; uStrength fades the whole field in/out
 *    so particles relax home when the cursor leaves
 *  - uGust multiplies turbulence during SOLAR GUST events
 *
 * Apply as `worldModifier` on SplatMesh — it runs in world space after
 * the object transform, so the cursor uniform can be a plain world point.
 */
import * as THREE from 'three';
import { dyno } from '@sparkjsdev/spark';

const D = dyno;

export interface FlowUniforms {
  time: { value: number };
  mouse: { value: THREE.Vector3 };
  strength: { value: number };
  gust: { value: number };
}

export function createFlowModifier(): { modifier: any; uniforms: FlowUniforms } {
  const uTime = D.dynoFloat(0, 'uFlowTime');
  const uMouse = D.dynoVec3(new THREE.Vector3(0, 0, 5), 'uFlowMouse');
  const uStrength = D.dynoFloat(0, 'uFlowStrength');
  const uGust = D.dynoFloat(0, 'uFlowGust');

  const INFLUENCE_RADIUS = D.dynoConst('float', 1.6);
  const EPS = D.dynoConst('float', 0.02);
  const UP = D.dynoConst('vec3', new THREE.Vector3(0, 1, 0));
  const AMP = D.dynoFloat(0.04, 'uFlowAmp');

  const modifier = D.dynoBlock(
    { gsplat: D.Gsplat },
    { gsplat: D.Gsplat },
    ({ gsplat }: any) => {
      if (!gsplat) throw new Error('flowModifier: missing gsplat');
      const center = D.splitGsplat(gsplat).outputs.center;
      const c = D.split(center);
      const px = c.outputs.x;
      const py = c.outputs.y;
      const pz = c.outputs.z;
      const t = uTime;

      // Ambient flow — two octaves of position-keyed sine turbulence.
      // Because the field is a pure function of position+time, splats
      // drift organically yet always settle back to their anchors.
      const f1 = D.combine({
        vectorType: 'vec3',
        x: D.sin(D.add(D.mul(py, D.dynoConst('float', 1.9)), D.mul(t, D.dynoConst('float', 0.6)))),
        y: D.sin(D.add(D.mul(pz, D.dynoConst('float', 1.6)), D.mul(t, D.dynoConst('float', -0.45)))),
        z: D.sin(D.add(D.mul(px, D.dynoConst('float', 2.1)), D.mul(t, D.dynoConst('float', 0.55)))),
      });
      const f2 = D.combine({
        vectorType: 'vec3',
        x: D.sin(D.add(D.add(D.mul(pz, D.dynoConst('float', 3.3)), D.mul(py, D.dynoConst('float', 1.1))), D.mul(t, D.dynoConst('float', -0.9)))),
        y: D.sin(D.add(D.add(D.mul(px, D.dynoConst('float', 2.7)), D.mul(pz, D.dynoConst('float', 0.9))), D.mul(t, D.dynoConst('float', 0.75)))),
        z: D.sin(D.add(D.add(D.mul(py, D.dynoConst('float', 3.0)), D.mul(px, D.dynoConst('float', 0.8))), D.mul(t, D.dynoConst('float', 1.05)))),
      });
      const gustMul = D.add(D.dynoConst('float', 1), D.mul(uGust, D.dynoConst('float', 1.6)));
      const flow = D.mul(D.add(f1, D.mul(f2, D.dynoConst('float', 0.45))), D.mul(AMP, gustMul));

      // Cursor parting — push away + tangential swirl inside radius.
      const toMouse = D.sub(uMouse, center);
      const dist = D.length(toMouse);
      const dir = D.div(toMouse, D.max(dist, EPS));
      const infl = D.sub(D.dynoConst('float', 1), D.smoothstep(D.dynoConst('float', 0), INFLUENCE_RADIUS, dist));
      const push = D.mul(dir, D.mul(infl, uStrength));
      const tangent = D.normalize(D.cross(dir, UP));
      const swirlPhase = D.add(D.mul(t, D.dynoConst('float', 2.0)), D.mul(dist, D.dynoConst('float', 4.0)));
      const swirl = D.mul(tangent, D.mul(D.mul(infl, uStrength), D.mul(D.sin(swirlPhase), D.dynoConst('float', 0.6))));

      const offset = D.add(flow, D.add(D.mul(push, D.dynoConst('float', 0.5)), swirl));
      return {
        gsplat: D.combineGsplat({ gsplat, center: D.add(center, offset) }),
      };
    },
    { globals: () => [D.defineGsplat] },
  );

  return {
    modifier,
    uniforms: {
      time: uTime as any,
      mouse: uMouse as any,
      strength: uStrength as any,
      gust: uGust as any,
    },
  };
}

/** Ray from camera through pointer NDC, intersected with the sphere of
 *  radius `radius` around `center` — returns a world-space point the
 *  splats can part around. Falls back to closest approach on miss. */
export function pointerToSphere(
  pointer: THREE.Vector2,
  camera: THREE.Camera,
  center = new THREE.Vector3(0, 0, 0),
  radius = 1.5,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const rc = new THREE.Raycaster();
  rc.setFromCamera(pointer, camera);
  const o = rc.ray.origin;
  const d = rc.ray.direction;
  const oc = o.clone().sub(center);
  const b = oc.dot(d);
  const c = oc.lengthSq() - radius * radius;
  const disc = b * b - c;
  if (disc > 0) {
    const t = -b - Math.sqrt(disc);
    if (t > 0) return out.copy(o).addScaledVector(d, t);
  }
  // closest approach to sphere center
  const t = Math.max(0, -b);
  return out.copy(o).addScaledVector(d, t);
}
